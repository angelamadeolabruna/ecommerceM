import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  OneToMany,
} from 'typeorm';
import type { Cliente } from '../clientes/CE_Modelos.js';

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn({ name: 'id_rol' })
  id_rol: number;

  @Column({ name: 'nombre_rol', type: 'varchar', length: 60, unique: true })
  nombre_rol: string;

  @Column({ name: 'descripcion', type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ name: 'permisos_json', type: 'jsonb', default: () => "'[]'" })
  permisos_json: unknown[];

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activo' })
  estado: string;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'id_usuario' })
  id_usuario: number;

  @Column({ name: 'email', type: 'varchar', length: 120, unique: true })
  email: string;

  @Column({ name: 'ci', type: 'varchar', length: 30, unique: true, nullable: true })
  ci: string | null;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Pendiente' })
  estado: string;

  @Column({ name: 'intentos_fallidos', type: 'int', default: 0 })
  intentos_fallidos: number;

  @Column({ name: 'bloqueado_hasta', type: 'timestamp', nullable: true })
  bloqueado_hasta: Date | null;

  @CreateDateColumn({ name: 'fecha_creacion', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;

  @Column({ name: 'fecha_ultimo_acceso', type: 'timestamp', nullable: true })
  fecha_ultimo_acceso: Date | null;

  @Column({ name: 'ultimo_login', type: 'timestamp', nullable: true })
  ultimo_login: Date | null;

  @OneToMany(() => UsuarioRol, (ur) => ur.usuario, { cascade: ['remove'] })
  roles: UsuarioRol[];

  @OneToOne('Cliente', (cliente: { usuario: Usuario }) => cliente.usuario)
  cliente: Cliente | null;

  @OneToOne(() => UsuarioEmpleado, (ue) => ue.usuario)
  empleado: UsuarioEmpleado | null;

  get rol(): Rol | null {
    if (this.roles && this.roles.length > 0) {
      return this.roles[0].rol;
    }
    return null;
  }

  get nombre(): string | null {
    if (this.cliente) {
      return this.cliente.nombre;
    }
    if (this.empleado) {
      return this.empleado.nombre;
    }
    return null;
  }
}

@Entity('usuarios_roles')
export class UsuarioRol {
  @PrimaryColumn({ name: 'id_usuario', type: 'int' })
  id_usuario: number;

  @PrimaryColumn({ name: 'id_rol', type: 'int' })
  id_rol: number;

  @ManyToOne(() => Usuario, (usuario) => usuario.roles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id_usuario' })
  usuario: Usuario;

  @ManyToOne(() => Rol)
  @JoinColumn({ name: 'id_rol' })
  rol: Rol;
}

@Entity('ciudades')
export class Ciudad {
  @PrimaryGeneratedColumn({ name: 'id_ciudad' })
  id_ciudad: number;

  @Column({ name: 'nombre', type: 'varchar', length: 80, unique: true })
  nombre: string;

  @Column({ name: 'pais', type: 'varchar', length: 60, default: 'Bolivia' })
  pais: string;

  @Column({ name: 'departamento', type: 'varchar', length: 60, nullable: true })
  departamento: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activa' })
  estado: string;
}

@Entity('sucursales')
export class Sucursal {
  @PrimaryGeneratedColumn({ name: 'id_sucursal' })
  id_sucursal: number;

  @Column({ name: 'nombre', type: 'varchar', length: 100 })
  nombre: string;

  @Column({ name: 'direccion', type: 'text' })
  direccion: string;

  @Column({ name: 'id_ciudad', type: 'int', nullable: true })
  id_ciudad: number | null;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'Activa' })
  estado: string;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;
}

@Entity('usuarios_empleados')
export class UsuarioEmpleado {
  @PrimaryGeneratedColumn({ name: 'id_empleado' })
  id_empleado: number;

  @OneToOne(() => Usuario, (usuario) => usuario.empleado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'sucursal_id', type: 'int', nullable: true })
  sucursal_id: number | null;

  @Column({ name: 'nombre', type: 'varchar', length: 120 })
  nombre: string;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'rol', type: 'varchar', length: 60 })
  rol: string;

  @Column({ name: 'fecha_baja', type: 'timestamp', nullable: true })
  fecha_baja: Date | null;

  @Column({ name: 'motivo_baja', type: 'varchar', length: 255, nullable: true })
  motivo_baja: string | null;
}

@Entity('first_password_tokens')
export class FirstPasswordToken {
  @PrimaryGeneratedColumn({ name: 'id_token' })
  id_token: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ name: 'token', type: 'varchar', length: 36, unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expires_at: Date;

  @Column({ name: 'used', type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}

@Entity('email_confirmations')
export class EmailConfirmation {
  @PrimaryGeneratedColumn({ name: 'id_confirmacion' })
  id_confirmacion: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ name: 'token', type: 'varchar', length: 36, unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expires_at: Date;

  @Column({ name: 'used', type: 'boolean', default: false })
  used: boolean;

  @Column({ name: 'confirmado_en', type: 'timestamp', nullable: true })
  confirmado_en: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}

@Entity('password_resets')
export class PasswordReset {
  @PrimaryGeneratedColumn({ name: 'id_reset' })
  id_reset: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ name: 'email', type: 'varchar', length: 120 })
  email: string;

  @Column({ name: 'token', type: 'varchar', length: 36, unique: true })
  token: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expires_at: Date;

  @Column({ name: 'used', type: 'boolean', default: false })
  used: boolean;

  @Column({ name: 'ip_origen', type: 'varchar', length: 45, nullable: true })
  ip_origen: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}

@Entity('token_blacklist')
export class TokenBlacklist {
  @PrimaryGeneratedColumn({ name: 'id_token' })
  id_token: number;

  @Column({ name: 'jti', type: 'varchar', length: 128, unique: true })
  jti: string;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ name: 'expira_en', type: 'timestamp' })
  expira_en: Date;

  @CreateDateColumn({ name: 'revocado_en', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  revocado_en: Date;
}

@Entity('sesiones')
export class Sesion {
  @PrimaryGeneratedColumn({ name: 'id_sesion' })
  id_sesion: number;

  @Column({ name: 'usuario_id', type: 'int', nullable: true })
  usuario_id: number | null;

  @Column({ name: 'refresh_token', type: 'varchar', length: 255, unique: true, nullable: true })
  refresh_token: string | null;

  @Column({ name: 'ip_origen', type: 'varchar', length: 45, nullable: true })
  ip_origen: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ name: 'fecha_inicio', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_inicio: Date;

  @Column({ name: 'fecha_fin', type: 'timestamp', nullable: true })
  fecha_fin: Date | null;

  @Column({ name: 'activa', type: 'boolean', default: true })
  activa: boolean;
}

@Entity('bitacora_auditoria')
export class BitacoraAuditoria {
  @PrimaryGeneratedColumn({ name: 'id_bitacora' })
  id_bitacora: number;

  @Column({ name: 'id_usuario', type: 'int', nullable: true })
  id_usuario: number | null;

  @Column({ name: 'accion_sql', type: 'varchar', length: 40, nullable: true })
  accion_sql: string | null;

  @Column({ name: 'tabla_afectada', type: 'varchar', length: 80, nullable: true })
  tabla_afectada: string | null;

  @Column({ name: 'id_registro', type: 'int', nullable: true })
  id_registro: number | null;

  @Column({ name: 'detalle', type: 'text', nullable: true })
  detalle: string | null;

  @Column({ name: 'old_data', type: 'jsonb', nullable: true })
  old_data: unknown[] | Record<string, unknown> | null;

  @Column({ name: 'new_data', type: 'jsonb', nullable: true })
  new_data: unknown[] | Record<string, unknown> | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ name: 'fecha_hora', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_hora: Date;
}

@Entity('reportes_generativos')
export class ReporteGenerativo {
  @PrimaryGeneratedColumn({ name: 'id_reporte' })
  id_reporte: number;

  @Column({ name: 'id_usuario', type: 'int' })
  id_usuario: number;

  @Column({ name: 'tipo', type: 'varchar', length: 40 })
  tipo: string;

  @Column({ name: 'parametros', type: 'jsonb' })
  parametros: Record<string, unknown>;

  @Column({ name: 'formato', type: 'varchar', length: 10 })
  formato: string;

  @Column({ name: 'url_archivo', type: 'text' })
  url_archivo: string;

  @CreateDateColumn({ name: 'fecha', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha: Date;
}