import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { User } from 'src/modules/users/entities/user.entity';
import { Product } from 'src/modules/products/entities/product.entity';
config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT as string, 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  synchronize: false,
  entities: [User, Product],
  migrations: ['dist/database/migrations/**/*{.ts,.js}'],
  migrationsRun: false,
  logging: true,
});

export default AppDataSource;
