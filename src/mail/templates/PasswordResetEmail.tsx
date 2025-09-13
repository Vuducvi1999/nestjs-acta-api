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
  resetUrl: string;
}

export const PasswordResetEmail = ({
  name = 'Khách hàng',
  resetUrl = '#',
}: Props) => (
  <Html lang="vi">
    <Head>
      <meta httpEquiv="Content-Language" content="vi" />
      <meta name="language" content="Vietnamese" />
      <meta name="google" content="notranslate" />
    </Head>
    <Preview>
      Xác nhận thay đổi mật khẩu cho tài khoản Liên minh Cộng đồng Affiliate
      thực chiếncủa bạn
    </Preview>
    <Body style={main}>
      <Container style={container}>
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
          <Heading style={h1}>Xin chào {name}!</Heading>

          <Text style={text}>
            Bạn đã yêu cầu thay đổi mật khẩu. Nhấp vào liên kết bên dưới để đặt
            mật khẩu mới:
          </Text>

          <Section style={buttonContainer}>
            <Button style={button} href={resetUrl}>
              🔐 Xác nhận thay đổi mật khẩu
            </Button>
          </Section>

          <Section style={warningSection}>
            <Text style={warningTitle}>🛡️ Bảo mật tài khoản</Text>
            <Text style={warningText}>
              Nếu bạn không yêu cầu thay đổi mật khẩu, bạn có thể bỏ qua email
              này một cách an toàn. Tài khoản của bạn vẫn được bảo mật.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            <strong>⏰ Lưu ý:</strong> Liên kết này sẽ hết hạn sau 5 phút. Sau
            thời gian này, bạn sẽ cần yêu cầu đặt lại mật khẩu mới.
          </Text>

          <Text style={footer}>
            Nếu bạn gặp khó khăn hoặc cần hỗ trợ, vui lòng liên hệ với chúng tôi
            tại{' '}
            <a
              href="mailto:lienhe@acta.vn"
              style={link}
              target="_blank"
              rel="noreferrer"
            >
              lienhe@acta.vn
            </a>
          </Text>

          <Section style={securityTipsSection}>
            <Text style={securityTitle}>💡 Mẹo bảo mật:</Text>
            <div style={tipsList}>
              <Text style={tipItem}>
                • Sử dụng mật khẩu mạnh với ít nhất 8 ký tự
              </Text>
              <Text style={tipItem}>
                • Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt
              </Text>
              <Text style={tipItem}>
                • Không chia sẻ mật khẩu với bất kỳ ai
              </Text>
              <Text style={tipItem}>
                • Thay đổi mật khẩu định kỳ để bảo mật tối ưu
              </Text>
            </div>
          </Section>
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
            Bạn nhận được email này vì đã yêu cầu thay đổi mật khẩu tại hệ thống
            ACTA của chúng tôi.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

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

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  background: 'linear-gradient(135deg, #ddbf94 0%, #cd853f 100%)',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '16px 32px',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 12px rgba(221, 191, 148, 0.3)',
  transition: 'all 0.3s ease',
};

const warningSection = {
  backgroundColor: '#fff8dc',
  padding: '20px',
  borderRadius: '8px',
  margin: '24px 0',
  border: '1px solid #ddbf94',
};

const warningTitle = {
  color: '#8b4513',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const warningText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
};

const securityTipsSection = {
  backgroundColor: '#faf8f3',
  padding: '20px',
  borderRadius: '8px',
  margin: '24px 0',
  border: '1px solid #ddbf94',
};

const securityTitle = {
  color: '#8b4513',
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
