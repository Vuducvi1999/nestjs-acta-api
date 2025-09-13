import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ApiKeyOtpEmailProps {
  name: string;
  otp: string;
}

export const ApiKeyOtpEmail: React.FC<ApiKeyOtpEmailProps> = ({
  name,
  otp,
}) => {
  return (
    <Html>
      <Head />
      <Preview>Mã OTP xác thực lấy API Key</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Xác thực lấy API Key</Heading>
          <Text style={text}>Xin chào {name},</Text>
          <Text style={text}>
            Bạn đã yêu cầu lấy API Key cho tích hợp KiotViet. Vui lòng sử dụng
            mã OTP dưới đây để xác thực:
          </Text>
          <Text style={otpText}>{otp}</Text>
          <Text style={text}>
            Mã OTP này có hiệu lực trong 2 phút. Nếu bạn không thực hiện yêu cầu
            này, vui lòng bỏ qua email này.
          </Text>
          <Text style={text}>
            Trân trọng,
            <br />
            Đội ngũ ACTA
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '560px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
};

const text = {
  color: '#333',
  fontSize: '14px',
  lineHeight: '26px',
};

const otpText = {
  color: '#333',
  fontSize: '32px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  letterSpacing: '8px',
  margin: '40px 0',
  padding: '20px',
  backgroundColor: '#f4f4f4',
  borderRadius: '8px',
  fontFamily: 'monospace',
};
