#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/46c7ebca3b5817bbd8dc6251871f457f09f0d18f14e085195f5a84d6ebd09e1b/contract';
import endContract from '../../snapshots/46c7ebca3b5817bbd8dc6251871f457f09f0d18f14e085195f5a84d6ebd09e1b/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'Budget',
        columns: [
          col('categoryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('limitAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('month', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('year', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Category',
        columns: [
          col('color', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('icon', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isDefault', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'Category_type_check_f7113747',
            "\"type\" IN ('EXPENSE', 'INCOME', 'INVEST', 'DEBT', 'SAVINGS')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Debt',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('direction', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('dueDate', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paidAmount', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('person', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Debt_direction_check_e2438b22', "\"direction\" IN ('OWE', 'OWED')"),
          checkExpression(
            'Debt_status_check_b0be9e9f',
            "\"status\" IN ('PENDING', 'PARTIAL', 'PAID')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Goal',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('deadline', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('savedAmount', 'numeric', {
            notNull: true,
            default: lit('0'),
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('targetAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'InvestLog',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('investmentId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('price', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('InvestLog_action_check_4618e6fc', "\"action\" IN ('BUY', 'SELL')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'Investment',
        columns: [
          col('boughtAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('buyPrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('currentPrice', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('ticker', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'Transaction',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('categoryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('goalId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('note', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recordedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('Transaction_type_check_5d925dfc', "\"type\" IN ('INCOME', 'EXPENSE')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'User',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('password', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('timezone', 'text', {
            notNull: true,
            default: lit('Asia/Ho_Chi_Minh'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Budget',
        constraint: 'Budget_userId_categoryId_month_year_key',
        columns: ['userId', 'categoryId', 'month', 'year'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'Category',
        constraint: 'Category_userId_name_key',
        columns: ['userId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'User',
        constraint: 'User_email_key',
        columns: ['email'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Budget',
        index: 'Budget_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Budget',
        index: 'Budget_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Category',
        index: 'Category_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Debt',
        index: 'Debt_userId_direction_idx_30a41d19',
        columns: ['userId', 'direction'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Debt',
        index: 'Debt_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Debt',
        index: 'Debt_userId_status_idx_e4a128ba',
        columns: ['userId', 'status'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Goal',
        index: 'Goal_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'InvestLog',
        index: 'InvestLog_investmentId_idx_a040f76a',
        columns: ['investmentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Investment',
        index: 'Investment_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_categoryId_idx_15c304f2',
        columns: ['categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_goalId_idx_8733343e',
        columns: ['goalId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_categoryId_idx_5ac7f7c5',
        columns: ['userId', 'categoryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_recordedAt_idx_dcff520b',
        columns: ['userId', 'recordedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'Transaction',
        index: 'Transaction_userId_type_idx_59b0b5ce',
        columns: ['userId', 'type'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Budget',
        foreignKey: {
          name: 'Budget_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Budget',
        foreignKey: {
          name: 'Budget_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Category',
        foreignKey: {
          name: 'Category_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Debt',
        foreignKey: {
          name: 'Debt_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Goal',
        foreignKey: {
          name: 'Goal_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'InvestLog',
        foreignKey: {
          name: 'InvestLog_investmentId_fkey',
          columns: ['investmentId'],
          references: { schema: 'public', table: 'Investment', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Investment',
        foreignKey: {
          name: 'Investment_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_categoryId_fkey',
          columns: ['categoryId'],
          references: { schema: 'public', table: 'Category', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_goalId_fkey',
          columns: ['goalId'],
          references: { schema: 'public', table: 'Goal', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'Transaction',
        foreignKey: {
          name: 'Transaction_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'User', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
