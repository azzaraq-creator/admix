"use client";

import { ListBox, Select } from "@heroui/react";
import { useState } from "react";

const YEARS = [2026];

/** 연도 고르기(HeroUI Select + ListBox) — 대시보드 차트 머리에 둔다. */
export function YearSelect() {
  const [selected, setSelected] = useState(YEARS[0]);

  return (
    <Select
      aria-label="연도"
      className="w-[100px]"
      selectedKey={String(selected)}
      onSelectionChange={(key) => {
        if (key != null) setSelected(Number(key));
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {YEARS.map((year) => (
            <ListBox.Item key={year} id={String(year)} textValue={String(year)}>
              {year}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
