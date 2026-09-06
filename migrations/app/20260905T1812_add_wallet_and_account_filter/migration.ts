#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/46c7ebca3b5817bbd8dc6251871f457f09f0d18f14e085195f5a84d6ebd09e1b/contract';
import startContract from '../../snapshots/46c7ebca3b5817bbd8dc6251871f457f09f0d18f14e085195f5a84d6ebd09e1b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/61b3e5556c0cf8178552461ca981c95681e371826d8f9692044054863c3c561f/contract';
import endContract from '../../snapshots/61b3e5556c0cf8178552461ca981c95681e371826d8f9692044054863c3c561f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'Wallet',
        columns: [
          col('accountNumber', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('balance', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('bankName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('color', 'text', { default: lit('#7c3aed'), codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('icon', 'text', { default: lit('Landmark'), codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isDefault', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'Transaction',
        column: col('walletId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_walletId_idx_7f86a2cd',
        columns: ['userId', 'walletId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_walletId_idx_2e003173',
        columns: ['walletId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Wallet',
        index: 'Wallet_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Wallet',
        foreignKey: {
          name: 'Wallet_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_walletId_fkey',
          columns: ['walletId'],
          references: { schema: 'public', table: 'Wallet', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
