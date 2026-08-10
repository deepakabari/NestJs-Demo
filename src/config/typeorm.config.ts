import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
import { Session } from '../modules/cognito-auth/entities/session.entity';
config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT as string, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [User, Session],
  migrations: ['dist/database/migrations/**/*{.ts,.js}'],
  migrationsRun: false,
  logging: false,
});

export default AppDataSource;
