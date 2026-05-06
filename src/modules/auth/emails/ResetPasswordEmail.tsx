import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components';

interface Props {
  name: string | null;
  url: string;
}

export function ResetPasswordEmail({ name, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Restablecé tu contraseña</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f5f5f5', padding: 24 }}>
        <Container style={{ backgroundColor: 'white', padding: 24, borderRadius: 8, maxWidth: 480 }}>
          <Heading>Restablecer contraseña</Heading>
          <Text>Hola{name ? ` ${name}` : ''},</Text>
          <Text>
            Recibimos un pedido para restablecer la contraseña. El link expira
            en 30 minutos.
          </Text>
          <Section style={{ textAlign: 'center', padding: '16px 0' }}>
            <Button
              href={url}
              style={{
                backgroundColor: '#374151',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 6,
                textDecoration: 'none',
              }}
            >
              Restablecer contraseña
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            Si no pediste esto, ignorá este email. Tu contraseña actual sigue vigente.
          </Text>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            ¿No funciona? Copiá: <Link href={url}>{url}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
