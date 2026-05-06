import Link from 'next/link';
import { auth } from '@/shared/lib/auth';
import { headers } from 'next/headers';
import { Button } from '@/shared/components/ui/button';
import { ArrowRight, CheckCircle, Shield, Zap } from 'lucide-react';
import { APP_NAME, APP_SHORT_NAME, APP_DESCRIPTION } from '@/shared/config/instance';

/**
 * Landing Page
 *
 * Server Component - No requiere 'use client'
 * Los datos se renderizan en el servidor para mejor SEO y performance
 */

// Mock de features para la landing
const features = [
  {
    icon: Shield,
    title: 'Seguridad Avanzada',
    description: 'Sistema de permisos granular basado en roles para proteger tu información.',
  },
  {
    icon: Zap,
    title: 'Alto Rendimiento',
    description: 'Arquitectura optimizada con Server Components para máxima velocidad.',
  },
  {
    icon: CheckCircle,
    title: 'Fácil de Usar',
    description: 'Interfaz intuitiva diseñada para mejorar la productividad de tu equipo.',
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const isSignedIn = !!session;

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">{APP_SHORT_NAME}</span>
            </div>
            <span className="font-semibold text-lg">{APP_NAME}</span>
          </div>
          <nav className="flex items-center gap-4">
            {!isSignedIn ? (
              <>
                <Link href="/sign-in">
                  <Button variant="ghost">Iniciar Sesión</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>
                    Comenzar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Gestiona tu empresa
          <br />
          <span className="text-primary">de forma inteligente</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Plataforma integral para la gestión empresarial. Controla empleados, documentos, equipos y
          más desde un solo lugar.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {!isSignedIn ? (
            <Link href="/sign-in">
              <Button size="lg" className="w-full sm:w-auto">
                Iniciar Sesión
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/dashboard">
              <Button size="lg" className="w-full sm:w-auto">
                Ir al Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
          <Button size="lg" variant="outline" className="w-full sm:w-auto">
            Ver Demo
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24 border-t">
        <h2 className="text-3xl font-bold text-center mb-12">
          Todo lo que necesitas para gestionar tu empresa
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-lg border bg-card hover:shadow-md transition-shadow"
            >
              <feature.icon className="h-10 w-10 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="bg-primary rounded-2xl p-12 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold mb-4">Comienza hoy mismo</h2>
          <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
            Únete a las empresas que ya están optimizando su gestión con nuestra plataforma.
          </p>
          {!isSignedIn ? (
            <Link href="/sign-in">
              <Button size="lg" variant="secondary">
                Acceder a la Plataforma
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Link href="/dashboard">
              <Button size="lg" variant="secondary">
                Ir al Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-xs">{APP_SHORT_NAME}</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {APP_NAME} - {APP_DESCRIPTION}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {APP_NAME}. Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
