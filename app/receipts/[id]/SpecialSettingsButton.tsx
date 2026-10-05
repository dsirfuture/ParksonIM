"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type SpecialItem = {
  id: string;
  sku: string;
  nameZh: string;
  nameEs: string;
  expectedQty: number | null;
  goodQty: number;
  unexpected?: boolean;
};

type Props = {
  receiptId: string;
  receiptNo: string;
  currentLoginName: string;
  disabled?: boolean;
  buttonText: string;
  titleText: string;
  saveText: string;
  cancelText: string;
  savingText: string;
  disabledHintText: string;
  successText: string;
  failText: string;
  expectedQtyText: string;
  goodQtyText: string;
  addGoodQtyText: string;
  skuText: string;
  nameText: string;
  noRowsText: string;
  loginNameLabel: string;
  receiptNoLabel: string;
  remarkLabel: string;
  loginNamePlaceholder: string;
  receiptNoPlaceholder: string;
  remarkPlaceholder: string;
  requiredValidationText: string;
  receiptNoMismatchText: string;
  loginNameMismatchText: string;
  rows: SpecialItem[];
};

type DraftRow = {
  id: string;
  expectedQty: string;
  addGoodQty: string;
};

function toIntOrZero(value: string) {
  const num = Number(value);
  return Number.isFinite(num) && Number.isInteger(num) ? num : 0;
}

export function SpecialSettingsButton(props: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});
  const [loginName, setLoginName] = useState("");
  const [receiptNoInput, setReceiptNoInput] = useState("");
  const [remark, setRemark] = useState("");
  const [skuKeyword, setSkuKeyword] = useState("");

  const editableRows = useMemo(() => props.rows, [props.rows]);

  function openModal() {
    if (props.disabled) return;
    const next: Record<string, DraftRow> = {};
    for (const row of editableRows) {
      next[row.id] = {
        id: row.id,
        expectedQty: String(row.expectedQty ?? 0),
        addGoodQty: "",
      };
    }
    setDraft(next);
    setLoginName("");
    setReceiptNoInput("");
    setRemark("");
    setSkuKeyword("");
    setOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setOpen(false);
  }

  async function save() {
    try {
      setSaving(true);
      if (!loginName.trim() || !receiptNoInput.trim() || !remark.trim()) {
        throw new Error(props.requiredValidationText);
      }
      if (loginName.trim() !== props.currentLoginName.trim()) {
        throw new Error(props.loginNameMismatchText);
      }
      if (receiptNoInput.trim() !== props.receiptNo.trim()) {
        throw new Error(props.receiptNoMismatchText);
      }
      const updates = editableRows
        .map((row) => {
          const rowDraft = draft[row.id];
          const expectedQtyRaw = rowDraft?.expectedQty ?? String(row.expectedQty ?? 0);
          const addGoodQtyRaw = rowDraft?.addGoodQty ?? "";
          const expectedQty = Number(expectedQtyRaw);
          const addGoodQty = addGoodQtyRaw === "" ? 0 : toIntOrZero(addGoodQtyRaw);
          const currentExpected = Number(row.expectedQty ?? 0);
          const changedExpected = expectedQty !== currentExpected;
          const changedAddGood = addGoodQty !== 0;
          if (!changedExpected && !changedAddGood) return null;
          return {
            itemId: row.id,
            expectedQty,
            addGoodQty,
          };
        })
        .filter(Boolean);

      const response = await fetch(`/api/receipts/${props.receiptId}/special-settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loginName: loginName.trim(),
          receiptNo: receiptNoInput.trim(),
          remark: remark.trim(),
          updates,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || props.failText);
      }
      window.alert(props.successText);
      setOpen(false);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : props.failText);
    } finally {
      setSaving(false);
    }
  }

  const filteredRows = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();
    if (!keyword) return editableRows;
    return editableRows.filter((row) => {
      const source = [
        String(row.sku || ""),
        String(row.nameZh || ""),
        String(row.nameEs || ""),
      ]
        .join(" ")
        .toLowerCase();
      return source.includes(keyword);
    });
  }, [editableRows, skuKeyword]);

  return (
    <>
      <button
        type="button"
        disabled={props.disabled}
        title={props.disabled ? props.disabledHintText : props.buttonText}
        onClick={openModal}
        className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {props.buttonText}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="max-h-[86vh] w-full max-w-[980px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="text-base font-semibold text-slate-900">{props.titleText}</div>
              <input
                value={skuKeyword}
                onChange={(e) => setSkuKeyword(e.target.value)}
                placeholder="搜索商品编码"
                className="h-9 w-[220px] rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="max-h-[62vh] overflow-auto p-5">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {props.loginNameLabel}
                  </div>
                  <input
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder={props.loginNamePlaceholder}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {props.receiptNoLabel}
                  </div>
                  <input
                    value={receiptNoInput}
                    onChange={(e) => setReceiptNoInput(e.target.value)}
                    placeholder={props.receiptNoPlaceholder}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-slate-600">
                    {props.remarkLabel}
                  </div>
                  <input
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={props.remarkPlaceholder}
                    className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
              {filteredRows.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">{props.noRowsText}</div>
              ) : (
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-slate-50 text-left text-sm text-slate-500">
                      <th className="px-3 py-2 font-semibold">{props.skuText}</th>
                      <th className="px-3 py-2 font-semibold">{props.nameText}</th>
                      <th className="px-3 py-2 font-semibold">{props.expectedQtyText}</th>
                      <th className="px-3 py-2 font-semibold">{props.goodQtyText}</th>
                      <th className="px-3 py-2 font-semibold">{props.addGoodQtyText}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-sm text-slate-900">{row.sku || "-"}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {row.nameZh || row.nameEs || "-"}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            value={draft[row.id]?.expectedQty ?? String(row.expectedQty ?? 0)}
                            onChange={(e) =>
                              setDraft((prev) => ({
                                ...prev,
                                [row.id]: {
                                  ...(prev[row.id] || {
                                    id: row.id,
                                    addGoodQty: "",
                                  }),
                                  expectedQty: e.target.value,
                                },
                              }))
                            }
                            className="h-9 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-primary"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-400">
                          {(() => {
                            const adjust = toIntOrZero(draft[row.id]?.addGoodQty ?? "0");
                            if (adjust === 0) return <span>{row.goodQty}</span>;
                            const base = row.goodQty;
                            const result = Math.max(base + adjust, 0);
                            const op = adjust > 0 ? "+" : "-";
                            const delta = Math.abs(adjust);
                            return (
                              <span>
                                {base}
                                <span className="mx-0.5 text-rose-600 font-bold">
                                  {op}
                                  {delta}
                                  =
                                  {result}
                                </span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                              onClick={() =>
                                setDraft((prev) => {
                                  const current = toIntOrZero(prev[row.id]?.addGoodQty ?? "0");
                                  return {
                                    ...prev,
                                    [row.id]: {
                                      ...(prev[row.id] || {
                                        id: row.id,
                                        expectedQty: String(row.expectedQty ?? 0),
                                      }),
                                      addGoodQty: String(current - 1),
                                    },
                                  };
                                })
                              }
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={draft[row.id]?.addGoodQty ?? ""}
                              onChange={(e) =>
                                setDraft((prev) => ({
                                  ...prev,
                                  [row.id]: {
                                    ...(prev[row.id] || {
                                      id: row.id,
                                      expectedQty: String(row.expectedQty ?? 0),
                                    }),
                                    addGoodQty: e.target.value,
                                  },
                                }))
                              }
                              className="h-9 w-[84px] rounded-lg border border-slate-200 px-2 text-center text-sm outline-none focus:border-primary"
                              placeholder="0"
                            />
                            <button
                              type="button"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-base font-semibold text-slate-700 transition hover:bg-slate-50"
                              onClick={() =>
                                setDraft((prev) => {
                                  const current = toIntOrZero(prev[row.id]?.addGoodQty ?? "0");
                                  return {
                                    ...prev,
                                    [row.id]: {
                                      ...(prev[row.id] || {
                                        id: row.id,
                                        expectedQty: String(row.expectedQty ?? 0),
                                      }),
                                      addGoodQty: String(current + 1),
                                    },
                                  };
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {props.cancelText}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? props.savingText : props.saveText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
