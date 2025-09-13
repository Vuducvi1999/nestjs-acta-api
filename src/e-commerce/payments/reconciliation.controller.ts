import {
  Controller,
  Post,
  Body,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RefundsService } from './refunds.service';
import { PaymentsService } from './payments.service';
import { ReconcileUploadDto, ReconciliationResultDto } from './dto/refund.dto';

@ApiTags('Reconciliation')
@ApiBearerAuth()
@Controller('reconcile')
export class ReconciliationController {
  private readonly logger = new Logger(ReconciliationController.name);

  constructor(
    private readonly refundsService: RefundsService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post('bank/csv')
  @ApiOperation({
    summary: 'Upload bank statement CSV for reconciliation',
    description: 'Upload bank statement CSV to match payments and refunds',
  })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation completed successfully',
    type: ReconciliationResultDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid CSV format',
  })
  async uploadBankStatement(
    @Body() dto: ReconcileUploadDto,
  ): Promise<ReconciliationResultDto> {
    this.logger.log('Processing bank statement CSV for reconciliation');

    try {
      // Decode base64 CSV content
      const csvContent = Buffer.from(dto.csvBase64, 'base64').toString('utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        throw new BadRequestException(
          'CSV must have at least header and one data row',
        );
      }

      const header = lines[0].split(',');
      const dataRows = lines.slice(1);

      // Expected columns: date, amount, reference, txn_id
      const dateIndex = header.findIndex((col) =>
        col.toLowerCase().includes('date'),
      );
      const amountIndex = header.findIndex((col) =>
        col.toLowerCase().includes('amount'),
      );
      const referenceIndex = header.findIndex((col) =>
        col.toLowerCase().includes('reference'),
      );
      const txnIndex = header.findIndex(
        (col) =>
          col.toLowerCase().includes('txn') ||
          col.toLowerCase().includes('transaction'),
      );

      if (dateIndex === -1 || amountIndex === -1 || referenceIndex === -1) {
        throw new BadRequestException(
          'CSV must contain date, amount, and reference columns',
        );
      }

      let matchedRows = 0;
      let unmatchedRows = 0;
      let refundsSettled = 0;
      let paymentsReconciled = 0;
      const unmatchedRowsData: Array<{
        row: number;
        date: string;
        amount: number;
        reference: string;
        reason: string;
      }> = [];

      // Process each row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const columns = row.split(',');

        if (
          columns.length <
          Math.max(dateIndex, amountIndex, referenceIndex) + 1
        ) {
          unmatchedRowsData.push({
            row: i + 2, // +2 for 1-based indexing and header
            date: columns[dateIndex] || 'N/A',
            amount: parseFloat(columns[amountIndex]) || 0,
            reference: columns[referenceIndex] || 'N/A',
            reason: 'Invalid row format',
          });
          unmatchedRows++;
          continue;
        }

        const date = columns[dateIndex];
        const amount = parseFloat(columns[amountIndex]);
        const reference = columns[referenceIndex];
        const txnId = txnIndex !== -1 ? columns[txnIndex] : undefined;

        if (isNaN(amount) || amount <= 0) {
          unmatchedRowsData.push({
            row: i + 2,
            date,
            amount: 0,
            reference,
            reason: 'Invalid amount',
          });
          unmatchedRows++;
          continue;
        }

        // Parse reference to determine if it's a payment or refund
        const parsedRef = this.parseReference(reference);

        if (parsedRef.type === 'refund' && parsedRef.refundId) {
          // Try to settle refund
          try {
            await this.refundsService.settleRefund(
              parsedRef.refundId,
              {
                providerRef: txnId || `CSV_${Date.now()}_${i}`,
                settledAt: new Date(date),
              },
              'system',
            );
            refundsSettled++;
            matchedRows++;
          } catch (error) {
            unmatchedRowsData.push({
              row: i + 2,
              date,
              amount,
              reference,
              reason: `Refund settlement failed: ${error.message}`,
            });
            unmatchedRows++;
          }
        } else if (parsedRef.type === 'payment' && parsedRef.paymentId) {
          // Mark payment as reconciled (future enhancement)
          // For now, just count as matched
          paymentsReconciled++;
          matchedRows++;
        } else {
          unmatchedRowsData.push({
            row: i + 2,
            date,
            amount,
            reference,
            reason: 'Unknown reference format',
          });
          unmatchedRows++;
        }
      }

      const summary = `Successfully processed ${dataRows.length} rows, matched ${matchedRows}, settled ${refundsSettled} refunds, reconciled ${paymentsReconciled} payments`;

      this.logger.log(summary);

      return {
        totalRows: dataRows.length,
        matchedRows,
        unmatchedRowsCount: unmatchedRows,
        refundsSettled,
        paymentsReconciled,
        summary,
        unmatchedRows: unmatchedRowsData,
      };
    } catch (error) {
      this.logger.error(
        `Bank statement reconciliation failed: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Parse VietQR reference to extract payment/refund information
   */
  private parseReference(reference: string): {
    type: 'payment' | 'refund';
    orderCode?: string;
    paymentId?: string;
    refundId?: string;
  } {
    if (reference.startsWith('ACTA REF ')) {
      // Refund reference
      const refundId = reference.replace('ACTA REF ', '');
      return {
        type: 'refund',
        refundId,
      };
    } else if (reference.includes(' | pay:')) {
      // Payment reference
      const parts = reference.split(' | pay:');
      if (parts.length === 2) {
        const orderCode = parts[0].replace('ACTA ', '');
        const paymentId = parts[1];
        return {
          type: 'payment',
          orderCode,
          paymentId,
        };
      }
    }

    // Unknown format
    return {
      type: 'payment',
    };
  }
}
