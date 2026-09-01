"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_SERVICE_ID, STYLISTS } from "@/lib/booking";
import { BookingDrawer } from "./BookingDrawer";

/** 1 Service · 2 Date & time · 3 Details · 4 Confirmation */
export type BookingStep = 1 | 2 | 3 | 4;

export type BookingDetails = {
  first: string;
  last: string;
  email: string;
  phone: string;
  notes: string;
  agreed: boolean;
};

export type BookingState = {
  step: BookingStep;
  serviceId: string;
  stylist: string;
  dateIdx: number;
  time: string;
  details: BookingDetails;
};

const INITIAL_STATE: BookingState = {
  step: 1,
  serviceId: DEFAULT_SERVICE_ID,
  stylist: STYLISTS[0],
  dateIdx: 1,
  time: "10:00",
  details: { first: "", last: "", email: "", phone: "", notes: "", agreed: false },
};

type BookingContextValue = {
  open: boolean;
  openBooking: () => void;
  closeBooking: () => void;
  state: BookingState;
  next: () => void;
  back: () => void;
  setService: (serviceId: string) => void;
  setStylist: (stylist: string) => void;
  setDateIdx: (dateIdx: number) => void;
  setTime: (time: string) => void;
  setDetail: <K extends keyof BookingDetails>(
    key: K,
    value: BookingDetails[K],
  ) => void;
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error("useBooking must be used inside a <BookingProvider>");
  }
  return ctx;
}

export function BookingProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<BookingState>(INITIAL_STATE);

  // Selections persist between visits to the drawer; only the step resets.
  const openBooking = useCallback(() => {
    setState((s) => ({ ...s, step: 1 }));
    setOpen(true);
  }, []);

  const closeBooking = useCallback(() => {
    setOpen(false);
    setState((s) => ({ ...s, step: 1 }));
  }, []);

  const value = useMemo<BookingContextValue>(
    () => ({
      open,
      openBooking,
      closeBooking,
      state,
      next: () =>
        setState((s) => ({
          ...s,
          step: Math.min(4, s.step + 1) as BookingStep,
        })),
      back: () =>
        setState((s) => ({
          ...s,
          step: Math.max(1, s.step - 1) as BookingStep,
        })),
      setService: (serviceId) => setState((s) => ({ ...s, serviceId })),
      setStylist: (stylist) => setState((s) => ({ ...s, stylist })),
      setDateIdx: (dateIdx) => setState((s) => ({ ...s, dateIdx })),
      setTime: (time) => setState((s) => ({ ...s, time })),
      setDetail: (key, detailValue) =>
        setState((s) => ({ ...s, details: { ...s.details, [key]: detailValue } })),
    }),
    [open, state, openBooking, closeBooking],
  );

  return (
    <BookingContext.Provider value={value}>
      {children}
      {open && <BookingDrawer />}
    </BookingContext.Provider>
  );
}
