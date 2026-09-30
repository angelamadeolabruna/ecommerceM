import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginRequest {
  @IsString()
  @IsNotEmpty({ message: 'Credencial obligatoria.' })
  credencial!: string;

  @IsString()
  @IsNotEmpty({ message: 'Contraseña obligatoria.' })
  password!: string;
}

export class AuthResponse {
  access_token!: string;
  refresh_token!: string;
  token_type: string = 'bearer';
  usuario!: {
    id: number;
    nombre: string | null;
    email: string;
    rol: string | null;
    permisos: unknown[];
  };
}

export class CambiarPasswordRequest {
  @IsString()
  @IsNotEmpty({ message: 'Contraseña actual obligatoria.' })
  password_actual!: string;

  @IsString()
  @IsNotEmpty({ message: 'Nueva contraseña obligatoria.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La nueva contraseña no debe superar 72 caracteres.' })
  password_nueva!: string;
}

export class MensajeResponse {
  detail!: string;
}

export class ForgotPasswordRequest {
  @IsEmail({}, { message: 'Correo electrónico inválido.' })
  @IsNotEmpty({ message: 'El correo electrónico es obligatorio.' })
  email!: string;
}

export class ResetPasswordRequest {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio.' })
  token!: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La nueva contraseña no debe superar 72 caracteres.' })
  password!: string;
}

export class FirstPasswordRequest {
  @IsString()
  @IsNotEmpty({ message: 'El token es obligatorio.' })
  token!: string;

  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria.' })
  @MinLength(8, { message: 'La nueva contraseña debe tener al menos 8 caracteres.' })
  @MaxLength(72, { message: 'La nueva contraseña no debe superar 72 caracteres.' })
  password!: string;
}