'use client';

import { Bell, LogOut, MoreVertical, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';

import { authClient } from '@/shared/lib/auth-client';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/shared/components/ui/sidebar';

/**
 * Navegación de usuario en el sidebar
 * Integrado con Better Auth para datos del usuario
 */
export function _NavUser() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const sessionUser = session?.user as
    | (NonNullable<typeof session>['user'] & {
        firstName?: string | null;
        lastName?: string | null;
        imageKey?: string | null;
        imageUrl?: string | null;
      })
    | undefined;
  const isLoaded = !isPending;
  const { isMobile } = useSidebar();
  const { theme, setTheme } = useTheme();

  if (!isLoaded) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" className="animate-pulse">
            <div className="h-8 w-8 rounded-lg bg-muted" />
            <div className="grid flex-1 gap-1">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const fullName =
    [sessionUser?.firstName, sessionUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() ||
    sessionUser?.name ||
    'Usuario';

  const avatarSrc = sessionUser?.imageUrl ?? sessionUser?.image ?? undefined;

  const userInitials =
    sessionUser?.firstName && sessionUser?.lastName
      ? `${sessionUser.firstName[0]}${sessionUser.lastName[0]}`.toUpperCase()
      : sessionUser?.firstName?.[0]?.toUpperCase() ||
        sessionUser?.name?.[0]?.toUpperCase() ||
        'U';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={avatarSrc} alt={fullName} />
                <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{fullName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {sessionUser?.email || 'email@ejemplo.com'}
                </span>
              </div>
              <MoreVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={avatarSrc} alt={fullName} />
                  <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {sessionUser?.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled>
                <Bell className="mr-2 size-4" />
                Notificaciones
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  {theme === 'dark' ? (
                    <Moon className="mr-2 size-4" />
                  ) : theme === 'light' ? (
                    <Sun className="mr-2 size-4" />
                  ) : (
                    <Monitor className="mr-2 size-4" />
                  )}
                  Tema
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('light')}
                    >
                      <Sun className="mr-2 size-4" />
                      Claro
                      {theme === 'light' && (
                        <span className="ml-auto text-xs text-primary">Activo</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('dark')}
                    >
                      <Moon className="mr-2 size-4" />
                      Oscuro
                      {theme === 'dark' && (
                        <span className="ml-auto text-xs text-primary">Activo</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => setTheme('system')}
                    >
                      <Monitor className="mr-2 size-4" />
                      Sistema
                      {theme === 'system' && (
                        <span className="ml-auto text-xs text-primary">Activo</span>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => {
                void authClient.signOut({
                  fetchOptions: { onSuccess: () => router.push('/') },
                });
              }}
            >
              <LogOut className="mr-2 size-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
