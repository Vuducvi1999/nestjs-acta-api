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

interface Props {
  name: string;
  referrerName: string;
  rejectionReason: string;
  changeTime: Date;
}

export const ReferrerRequestChangeAccountEmail = ({
  name = 'Khách hàng',
  referrerName,
  rejectionReason = 'Cần cập nhật thông tin cá nhân',
  changeTime = new Date(),
}: Props) => (
  <Html lang="vi">
    <Head>
      <meta httpEquiv="Content-Language" content="vi" />
      <meta name="language" content="Vietnamese" />
      <meta name="google" content="notranslate" />
    </Head>
    <Preview>
      Người giới thiệu yêu cầu bạn cập nhật thông tin tài khoản ACTA. Vui lòng
      thực hiện thay đổi theo yêu cầu.
    </Preview>
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
          <Heading style={h1}>Xin chào {name},</Heading>

          <Text style={text}>
            Người giới thiệu <strong>{referrerName}</strong> đã xem xét tài
            khoản của bạn tại{' '}
            <strong>Liên minh Cộng đồng Affiliate thực chiến</strong> và yêu cầu
            bạn thực hiện một số thay đổi để hoàn tất quá trình phê duyệt.
          </Text>

          <Section style={requestSection}>
            <Text style={requestTitle}>
              Yêu cầu từ người giới thiệu {referrerName}:
            </Text>
            <Text style={requestText}>{rejectionReason}</Text>
          </Section>

          <Text style={text}>
            Người giới thiệu của bạn muốn đảm bảo rằng hồ sơ của bạn đáp ứng đầy
            đủ các tiêu chuẩn của ACTA để bạn có thể thành công trong hệ thống
            affiliate.
          </Text>

          <Text style={text}>Các bước thực hiện:</Text>

          <Section style={featuresSection}>
            <Text style={featureText}>
              • Đăng nhập vào tài khoản ACTA của bạn
            </Text>
            <Text style={featureText}>• Truy cập phần "Thông tin cá nhân"</Text>
            <Text style={featureText}>
              • Cập nhật thông tin theo yêu cầu của người giới thiệu
            </Text>
            <Text style={featureText}>
              • Lưu thay đổi và thông báo cho người giới thiệu
            </Text>
            <Text style={featureText}>
              • Liên hệ trực tiếp nếu cần hướng dẫn chi tiết
            </Text>
          </Section>

          <Section style={referrerContactSection}>
            <Text style={referrerContactText}>
              📞 <strong>Liên hệ người giới thiệu:</strong> Bạn có thể liên hệ
              trực tiếp với {referrerName} để được hỗ trợ cụ thể trong quá trình
              cập nhật thông tin.
            </Text>
          </Section>

          <Section style={noteSection}>
            <Text style={noteText}>
              <strong>Lưu ý:</strong> Sau khi hoàn tất các thay đổi, người giới
              thiệu {referrerName} sẽ xem xét lại và phê duyệt tài khoản của
              bạn.
            </Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Nếu bạn có bất kỳ câu hỏi nào về các yêu cầu thay đổi hoặc cần hỗ
            trợ kỹ thuật, vui lòng liên hệ với đội hỗ trợ của chúng tôi.
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
            Bạn nhận được email này vì người giới thiệu yêu cầu cập nhật thông
            tin tài khoản ACTA của bạn.
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

const requestSection = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fbbf24',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const requestTitle = {
  color: '#d97706',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 12px',
};

const requestText = {
  color: '#92400e',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0',
  fontStyle: 'italic',
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

const referrerContactSection = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #86efac',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const referrerContactText = {
  color: '#166534',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
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
