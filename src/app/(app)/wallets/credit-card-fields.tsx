"use client";

import { SmartCurrencyInput } from "@/components/ui/smart-currency-input";

export const CREDIT_CARD_BANKS = [
  "TPBank",
  "Techcombank",
  "Vietcombank",
  "VPBank",
  "MBBank",
  "VIB",
  "ACB",
  "Sacombank",
  "HSBC",
  "Shinhan",
  "Khác",
];

interface CreditCardFieldsProps {
  defaults?: {
    bankName?: string | null;
    accountNumber?: string | null;
    creditLimit?: number | null;
    openingDebt?: number;
    statementDay?: number | null;
    paymentDueDay?: number | null;
  };
}

const inputCls =
  "w-full px-3 py-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary";

/** Các trường riêng của thẻ tín dụng trong form tạo / sửa ví. */
export function CreditCardFields({ defaults }: CreditCardFieldsProps) {
  const bank = defaults?.bankName || "TPBank";
  const banks = CREDIT_CARD_BANKS.includes(bank) ? CREDIT_CARD_BANKS : [bank, ...CREDIT_CARD_BANKS];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Ngân hàng phát hành</label>
          <select name="bankName" defaultValue={bank} className={inputCls}>
            {banks.map((b) => (
              <option key={b} value={b}>
                {b === "Khác" ? "Ngân hàng khác" : b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">4 số cuối thẻ</label>
          <input
            type="text"
            name="accountNumber"
            inputMode="numeric"
            maxLength={4}
            pattern="[0-9]{0,4}"
            defaultValue={defaults?.accountNumber ? defaults.accountNumber.slice(-4) : ""}
            placeholder="VD: 1234"
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">
          Hạn mức tín dụng (VNĐ) <span className="text-rose-500">*</span>
        </label>
        <SmartCurrencyInput
          name="creditLimit"
          defaultValue={defaults?.creditLimit ?? ""}
          placeholder="VD: 50.000.000"
          className={inputCls}
          showWordsPreview
          required
        />
      </div>

      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">Dư nợ ban đầu (VNĐ)</label>
        <SmartCurrencyInput
          name="openingDebt"
          defaultValue={defaults?.openingDebt ?? 0}
          className={inputCls}
          showWordsPreview
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          Số tiền đang nợ trên thẻ tại thời điểm bắt đầu theo dõi. Các giao dịch chi tiêu bằng thẻ sau đó sẽ tự cộng vào dư nợ.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">
            Ngày chốt sao kê <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            name="statementDay"
            min={1}
            max={31}
            required
            defaultValue={defaults?.statementDay ?? 20}
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Ngày đến hạn thanh toán</label>
          <input
            type="number"
            name="paymentDueDay"
            min={1}
            max={31}
            defaultValue={defaults?.paymentDueDay ?? 5}
            className={inputCls}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Nếu ngày đến hạn nhỏ hơn hoặc bằng ngày chốt, hạn thanh toán được tính vào tháng sau.
      </p>
    </div>
  );
}
