import {
  Body,
  Container,
  Head,
  Html,
  Preview
} from '@react-email/components';

interface Props {
  name: string;
  url: string;
}

export const EmailChangeConfirmation = ({ name, url }: Props) => (
  <Html lang="vi">
    <Head>
      <meta httpEquiv="Content-Language" content="vi" />
      <meta name="language" content="Vietnamese" />
      <meta name="google" content="notranslate" />
    </Head>
    <Preview>
      Xác nhận thay đổi địa chỉ email Liên minh Cộng đồng Affiliate thực chiến của bạn
    </Preview>
    <Body
      style={{
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f9f9f9',
        padding: '20px',
      }}
    >
      <Container
        style={{
          backgroundColor: '#ffffff',
          padding: '24px',
          borderRadius: '6px',
        }}
      >
        <h1>Xin chào {name}!</h1>
        <p>
          Bạn đã yêu cầu thay đổi địa chỉ email. Nhấp vào liên kết bên dưới để
          xác nhận địa chỉ email mới:
        </p>
        <a
          style={{
            textDecoration: 'none',
            fontWeight: 'bold',
            display: 'inline-block',
            backgroundColor: '#ddbf94',
            padding: '12px 24px',
            borderRadius: '6px',
            color: '#ffffff',
          }}
          href={url}
        >
          ✉️ Xác nhận địa chỉ email mới
        </a>
        <p>
          Nếu bạn không yêu cầu thay đổi email, bạn có thể bỏ qua email này một
          cách an toàn.
        </p>
        <p>Liên kết này sẽ hết hạn trong 24 giờ.</p>
        <hr style={{ margin: '20px 0', borderColor: '#ddbf94' }} />
        <p style={{ fontSize: '12px', color: '#6b7280' }}>
          © 2025 ACTA - Affiliate Community's Tactical Alliance
          <br />
          Nếu cần hỗ trợ, liên hệ:{' '}
          <a href="mailto:lienhe@acta.vn" style={{ color: '#cd853f' }}>
            lienhe@acta.vn
          </a>
        </p>
      </Container>
    </Body>
  </Html>
);
