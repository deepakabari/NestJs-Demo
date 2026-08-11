import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from '../modules/users/entities/user.entity';
config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST!,
  port: parseInt(process.env.DB_PORT!, 10),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  synchronize: false,
  entities: [User],
  migrations: ['dist/database/migrations/**/*{.ts,.js}'],
  migrationsRun: false,
  logging: false,
});

export default AppDataSource;
