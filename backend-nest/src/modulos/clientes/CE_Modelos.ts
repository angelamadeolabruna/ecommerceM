import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../seguridad/CE_Modelos.js';

@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn({ name: 'id_cliente' })
  id_cliente: number;

  @OneToOne(() => Usuario, (usuario) => usuario.cliente, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'nombre', type: 'varchar', length: 150 })
  nombre: string;

  @Column({ name: 'telefono', type: 'varchar', length: 30, nullable: true })
  telefono: string | null;

  @Column({ name: 'direccion', type: 'text', nullable: true })
  direccion: string | null;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_registro: Date;
}