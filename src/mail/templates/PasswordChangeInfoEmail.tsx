import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
  Hr,
  Img,
} from '@react-email/components';

interface Props {
  name: string;
  changeTime: Date;
}

export const PasswordChangeInfoEmail = ({
  name = 'Khách hàng',
  changeTime = new Date(),
}: Props) => {
  return (
    <Html lang="vi">
      <Head>
        <meta httpEquiv="Content-Language" content="vi" />
        <meta name="language" content="Vietnamese" />
        <meta name="google" content="notranslate" />
      </Head>
      <Preview>
        Mật khẩu tài khoản Liên minh Cộng đồng Affiliate thực chiến của bạn đã
        được thay đổi thành công
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <div style={logoContainer}>
              <a
                href="https://acta.vn"
                target="_blank"
                rel="noopener noreferrer"
              >
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
            <Heading style={h1}>Xin chào {name}!</Heading>

            <Section style={successSection}>
              <div style={successIcon}>✅</div>
              <Text style={successTitle}>
                Mật khẩu đã được thay đổi thành công!
              </Text>
              <Text style={successText}>
                Mật khẩu cho tài khoản Liên minh Cộng đồng Affiliate thực chiến
                của bạn đã được cập nhật an toàn.
              </Text>
            </Section>

            <Section style={securitySection}>
              <Text style={securityTitle}>🛡️ Bảo mật tài khoản</Text>
              <Text style={securityText}>
                <strong>Nếu bạn không thực hiện thay đổi này:</strong>
              </Text>
              <Text style={securityText}>
                Vui lòng liên hệ ngay với đội hỗ trợ của chúng tôi để bảo vệ tài
                khoản. Có thể ai đó đã truy cập trái phép vào tài khoản của bạn.
              </Text>

              <Section style={buttonContainer}>
                <Button
                  style={emergencyButton}
                  href="mailto:lienhe@acta.vn?subject=Báo cáo bảo mật khẩn cấp"
                >
                  🚨 Báo cáo ngay
                </Button>
              </Section>
            </Section>

            <Hr style={hr} />

            <Section style={tipsSection}>
              <Text style={tipsTitle}>💡 Lời khuyên bảo mật:</Text>
              <div style={tipsList}>
                <Text style={tipItem}>
                  • Đăng xuất khỏi tất cả thiết bị nếu cần thiết
                </Text>
                <Text style={tipItem}>
                  • Không chia sẻ mật khẩu mới với bất kỳ ai
                </Text>
              </div>
            </Section>

            <Text style={footer}>
              Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với chúng tôi tại{' '}
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
              Bạn nhận được email này để xác nhận thay đổi bảo mật trên tài
              khoản ACTA của bạn.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// Styles with beige theme
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
  padding: '50px',
};

const h1 = {
  color: '#8b4513',
  fontSize: '28px',
  fontWeight: 'bold',
  margin: '0 0 24px',
  textAlign: 'left' as const,
};

const successSection = {
  backgroundColor: '#f0f9ff',
  padding: '32px',
  borderRadius: '12px',
  textAlign: 'center' as const,
  margin: '0 0 32px',
};

const successIcon = {
  fontSize: '48px',
  marginBottom: '12px',
};

const successTitle = {
  color: '#16a34a',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const successText = {
  color: '#374151',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
};

const securitySection = {
  backgroundColor: '#fef2f2',
  padding: '28px',
  borderRadius: '8px',
  margin: '32px 0',
};

const securityTitle = {
  color: '#dc2626',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const securityText = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 12px',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '16px 0 0',
};

const emergencyButton = {
  background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
};

const tipsSection = {
  backgroundColor: '#fffbeb',
  padding: '28px',
  borderRadius: '8px',
  margin: '32px 0',
};

const tipsTitle = {
  color: '#92400e',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const tipsList = {
  margin: '0',
};

const tipItem = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const hr = {
  borderColor: '#ddbf94',
  margin: '40px 0',
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
  padding: '30px 50px',
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
