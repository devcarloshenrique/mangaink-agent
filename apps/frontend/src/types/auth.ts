// Tipos de autenticação para o MangaInk
// Baseado nos contratos do backend (manga-ink/backend)

export interface User {
  id: string;
  username: string;
  email: string;
  kindleEmail: string | null;
  avatarUrl: string | null;
}

export interface LoginCredentials {
  /** E-mail ou nome de usuário */
  identifier: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface UpdateProfileData {
  username?: string;
  email?: string;
  kindleEmail?: string;
  avatarUrl?: string;
  currentPassword?: string;
  password?: string;
  confirmPassword?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface ApiError {
  error: string;
  issues?: unknown;
}
