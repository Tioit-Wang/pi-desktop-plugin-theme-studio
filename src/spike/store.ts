import { create } from "zustand";

type SpikeState = {
  clicks: number;
  bump: () => void;
};

/** 只为验证 zustand 能在这套打包里跑起来。 */
export const useSpikeStore = create<SpikeState>((set) => ({
  clicks: 0,
  bump: () => set((state) => ({ clicks: state.clicks + 1 })),
}));
