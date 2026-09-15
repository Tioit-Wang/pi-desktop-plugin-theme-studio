import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSpikeStore } from "@/spike/store";

const CHECKS = [
  ["React 19", "这个面板就是 React 渲染的"],
  ["Tailwind v4", "每一处间距/颜色都是工具类"],
  ["shadcn/ui", "Button / Tabs / Slider 是同样的写法"],
  ["Radix", "Tabs 与 Slider 走真实的 Radix 原语"],
  ["zustand", "计数走独立 store"],
  ["lucide", "图标是 SVG 组件"],
];

/**
 * 一次性验证面板：产物换成 IIFE 之后，这套栈在 file:// 下能不能真的跑。
 * 交付前会删掉。
 */
export function SpikePanel() {
  const clicks = useSpikeStore((state) => state.clicks);
  const bump = useSpikeStore((state) => state.bump);
  const [blur, setBlur] = useState([12]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto bg-background p-6 text-ink">
      <header className="flex items-center gap-2">
        <h1 className="text-ui-lg font-semibold">构建链自检</h1>
        <span className="rounded-full border border-line px-2 py-0.5 text-ui-2xs text-muted">
          IIFE · file://
        </span>
      </header>

      <ul className="grid gap-1.5" data-testid="checks">
        {CHECKS.map(([name, detail]) => (
          <li
            key={name}
            className="flex items-center gap-2 rounded-sm border border-line bg-tile px-2.5 py-1.5"
          >
            <b className="text-ui-md font-medium">{name}</b>
            <span className="text-ui-sm text-muted">{detail}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={bump}>
          点击计数 {clicks}
        </Button>
        <Button variant="default">默认按钮</Button>
      </div>

      <Tabs defaultValue="token" className="w-80">
        <TabsList>
          <TabsTrigger value="token">Token</TabsTrigger>
          <TabsTrigger value="image">图片</TabsTrigger>
          <TabsTrigger value="audit">检查</TabsTrigger>
        </TabsList>
        <TabsContent value="token">
          <div className="flex items-center gap-2">
            <span className="w-14 text-ui-sm text-muted">模糊</span>
            <Slider value={blur} min={0} max={40} step={1} onValueChange={setBlur} />
            <b className="w-6 text-right text-ui-sm tabular-nums">{blur[0]}</b>
          </div>
        </TabsContent>
        <TabsContent value="image">图片面板</TabsContent>
        <TabsContent value="audit">检查面板</TabsContent>
      </Tabs>
    </div>
  );
}
