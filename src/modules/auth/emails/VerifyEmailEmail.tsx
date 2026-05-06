import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from '@react-email/components';

interface Props {
  name: string | null;
  url: string;
}

export function VerifyEmailEmail({ name, url }: Props) {
  return (
    <Html>
      <Head />
      <Preview>Verificá tu email</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f5f5f5', padding: 24 }}>
        <Container style={{ backgroundColor: 'white', padding: 24, borderRadius: 8, maxWidth: 480 }}>
          <Heading>Verificá tu email</Heading>
          <Text>Hola{name ? ` ${name}` : ''},</Text>
          <Text>
            Para activar tu cuenta, hacé click en el botón de abajo. El link
            expira en 24 horas.
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
              Verificar email
            </Button>
          </Section>
          <Text style={{ fontSize: 12, color: '#6b7280' }}>
            ¿No funciona? Copiá este link: <Link href={url}>{url}</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
