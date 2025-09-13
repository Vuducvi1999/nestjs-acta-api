import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Hr,
  Button,
} from '@react-email/components';

interface Props {
  name: string;
  totalPosts: string;
  urlLink?: string;
}

export const UnpublishedPostNotification = ({
  name = 'Admin',
  totalPosts = '0',
  urlLink = '',
}: Props) => (
  <Html>
    <Head />
    <Preview>Nhắc nhở: Bài viết chưa được xuất bản</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={headerText}>
            Liên minh Cộng đồng Affiliate thực chiến
          </Heading>
        </Section>

        <Section style={content}>
          <Heading style={h2}>Xin chào {name}!</Heading>

          <Text style={paragraph}>
            Hệ thống đã phát hiện có{' '}
            <strong>{totalPosts} bài viết chưa được xuất bản</strong> trong hệ
            thống ACTA.
          </Text>

          <Text style={paragraph}>
            Để phê duyệt các bài viết này, vui lòng thực hiện các bước sau:
          </Text>

          <Section style={stepsList}>
            <Text style={stepItem}>
              1. Nhấn vào nút bên dưới để truy cập trang quản trị
            </Text>
            <Text style={stepItem}>
              2. Vào phần Quản lý bài đăng → Khoảng Khắc
            </Text>
            <Text style={stepItem}>
              3. Xem xét và phê duyệt các bài viết chưa xuất bản
            </Text>
          </Section>

          {urlLink && (
            <Section style={buttonContainer}>
              <Button style={button} href={urlLink}>
                🔗 Truy cập trang quản trị
              </Button>
            </Section>
          )}

          <Section style={noteBox}>
            <Text style={noteText}>
              ⚠️ Lưu ý: Các bài viết chưa xuất bản sẽ không hiển thị công khai
              và không được tính vào thống kê của hệ thống.
            </Text>
          </Section>

          <Text style={paragraph}>
            Nếu bạn cần hỗ trợ hoặc có thắc mắc, vui lòng liên hệ với đội kỹ
            thuật qua email:{' '}
            <Link href="mailto:lienhe@acta.vn" style={link}>
              lienhe@acta.vn
            </Link>
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Trân trọng,
            <br />
            <strong>Đội ngũ ACTA</strong>
          </Text>
        </Section>

        <Section style={footerSection}>
          <Text style={footerText}>
            Email này được gửi tự động từ hệ thống ACTA.
            <br />
            Vui lòng không trả lời email này.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: '#ffffff',
  fontFamily: 'Arial, sans-serif',
};

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  maxWidth: '600px',
};

const header = {
  backgroundColor: '#f8f9fa',
  padding: '20px',
  textAlign: 'center' as const,
};

const headerText = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
};

const content = {
  padding: '30px',
  backgroundColor: '#ffffff',
};

const h2 = {
  color: '#333',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 20px 0',
};

const paragraph = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0 0 20px 0',
};

const stepsList = {
  margin: '0 0 20px 0',
};

const stepItem = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '5px 0',
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#007bff',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
  border: 'none',
  cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
};

const noteBox = {
  backgroundColor: '#e7f3ff',
  padding: '15px',
  borderRadius: '8px',
  margin: '0 0 20px 0',
  border: '1px solid #b3d9ff',
};

const noteText = {
  color: '#0056b3',
  fontSize: '14px',
  fontWeight: 'bold',
  margin: '0',
};

const link = {
  color: '#007bff',
  textDecoration: 'underline',
};

const hr = {
  borderColor: '#e6e6e6',
  margin: '20px 0',
};

const footer = {
  color: '#666',
  fontSize: '14px',
  lineHeight: '1.6',
  margin: '0',
};

const footerSection = {
  backgroundColor: '#f8f9fa',
  padding: '20px',
  textAlign: 'center' as const,
};

const footerText = {
  fontSize: '12px',
  color: '#666',
  margin: '0',
};
