import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Section,
  Hr,
  Img,
} from '@react-email/components';

interface KycApprovedEmailProps {
  name: string;
  reviewerName: string;
}

export const KycApprovedEmail = ({
  name = 'Khách hàng',
  reviewerName = 'Đội ngũ ACTA',
}: KycApprovedEmailProps) => (
  <Html lang="vi">
    <Head>
      <meta httpEquiv="Content-Language" content="vi" />
      <meta name="language" content="Vietnamese" />
      <meta name="google" content="notranslate" />
    </Head>
    <Preview>Thông tin KYC của bạn đã được phê duyệt thành công!</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Header with ACTA logo */}
        <Section style={header}>
          <div style={logoContainer}>
            <a href="https://acta.vn" target="_blank" rel="noopener noreferrer">
              <Img
                src="https://res.cloudinary.com/dxwtk3y7p/image/upload/c_scale,w_350/v1750391179/acta-e-commerce/kq1zkhyfq63115pjonda.png"
                alt="ACTA Logo"
                width="350"
                height="130"
                style={logoImage}
              />
            </a>
          </div>
        </Section>
        {/* Main content */}
        <Section style={content}>
          <Heading style={h1}>Xin chúc mừng {name},</Heading>
          <Text style={text}>
            Chúng tôi vui mừng thông báo rằng thông tin Xác minh danh tính (KYC)
            của bạn tại{' '}
            <strong>Liên minh Cộng đồng Affiliate thực chiến</strong> đã được
            phê duyệt thành công!
          </Text>
          <Section style={approvalSection}>
            <Text style={approvalTitle}>
              Thông tin KYC của bạn đã được xác minh bởi {reviewerName}.
            </Text>
            <Text style={approvalText}>
              Giờ đây, bạn có thể truy cập đầy đủ các tính năng và dịch vụ của
              chúng tôi.
            </Text>
          </Section>
          <Text style={text}>
            Cảm ơn bạn đã hoàn tất quá trình xác minh. Điều này giúp chúng tôi
            đảm bảo một môi trường an toàn và đáng tin cậy cho tất cả các thành
            viên.
          </Text>
          <Text style={text}>Các bước tiếp theo:</Text>
          <Section style={featuresSection}>
            <Text style={featureText}>
              • Đăng nhập vào tài khoản ACTA của bạn
            </Text>
            <Text style={featureText}>
              • Khám phá các tính năng mới và cơ hội hợp tác
            </Text>
            <Text style={featureText}>
              • Bắt đầu hành trình kiếm tiền cùng ACTA!
            </Text>
          </Section>
          <Section style={noteSection}>
            <Text style={noteText}>
              <strong>Lưu ý:</strong> Nếu có bất kỳ thay đổi nào về thông tin cá
              nhân trong tương lai, vui lòng cập nhật để đảm bảo tài khoản của
              bạn luôn được xác minh.
            </Text>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            Nếu bạn có bất kỳ câu hỏi nào hoặc cần hỗ trợ, vui lòng liên hệ với
            đội hỗ trợ của chúng tôi.
          </Text>
          <Text style={footer}>
            Chúng tôi luôn sẵn sàng hỗ trợ bạn tại{' '}
            <a
              href="mailto:lienhe@acta.vn"
              style={link}
              target="_blank"
              rel="noreferrer"
            >
              lienhe@acta.vn
            </a>
          </Text>
        </Section>
        {/* Footer */}
        <Section style={footerSection}>
          <Text style={footerText}>
            © 2025 ACTA - Affiliate Community's Tactical Alliance
          </Text>
          <Text style={footerText}>Kết nối đỉnh cao, lợi nhuận bền vững</Text>
          <Text style={footerText}>Số điện thoại: 0912 880 330</Text>
          <Text style={footerText}>
            Địa chỉ: 135A Bình Quới, Phường Bình Quới, Tp. Hồ Chí Minh
          </Text>
          <Text style={footerText}>Website: https://acta.vn</Text>
          <Text style={footerText}>
            Bạn nhận được email này vì thông tin KYC của bạn đã được phê duyệt
            tại hệ thống ACTA.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default KycApprovedEmail;

// Styles with beige theme (reused from previous template for consistency)
const main = {
  backgroundColor: '#fefdf8',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
  boxShadow: '0 4px 20px rgba(221, 191, 148, 0.1)',
  borderRadius: '12px',
  overflow: 'hidden',
};

const header = {
  padding: '30px 40px',
  background: 'linear-gradient(135deg, #f5f5dc 0%, #ddbf94 100%)',
  borderRadius: '12px 12px 0 0',
};

const logoContainer = {
  textAlign: 'center' as const,
};

const logoImage = {
  margin: '0 auto',
  display: 'block',
};

const content = {
  padding: '40px',
};

const h1 = {
  color: '#8b4513',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  textAlign: 'left' as const,
};

const text = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 24px',
};

const approvalSection = {
  backgroundColor: '#e6ffe6', // Light green for approval
  border: '1px solid #4CAF50', // Green border
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const approvalTitle = {
  color: '#2E8B57', // Darker green
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const approvalText = {
  color: '#3CB371', // Medium green
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
  fontStyle: 'italic',
};

const noteSection = {
  backgroundColor: '#f0f9ff',
  border: '1px solid #7dd3fc',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const noteText = {
  color: '#0c4a6e',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const featuresSection = {
  margin: '24px 0',
  padding: '0 0 0 20px',
};

const featureText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 12px',
};

const hr = {
  borderColor: '#ddbf94',
  margin: '32px 0',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 16px',
};

const link = {
  color: '#cd853f',
  textDecoration: 'underline',
  fontWeight: '600',
};

const footerSection = {
  padding: '20px 40px',
  background: 'linear-gradient(135deg, #faf8f3 0%, #f5f5dc 100%)',
  borderRadius: '0 0 12px 12px',
  borderTop: '1px solid #ddbf94',
};

const footerText = {
  color: '#8b4513',
  fontSize: '12px',
  lineHeight: '1.4',
  margin: '0 0 8px',
  textAlign: 'center' as const,
};
