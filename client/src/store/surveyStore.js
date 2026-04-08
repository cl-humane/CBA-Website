// client/src/store/surveyStore.js
// Holds rater info, chosen ratee, active period, and all in-progress answers.
// Answers are keyed by question_id (matches the `answers` table schema).

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

const useSurveyStore = create(
  persist(
    (set) => ({
      // ── Auth / User ───────────────────────────────────────
      rater: null,          // { id, full_name, email, role, department_id }
      token: null,

      // ── Survey Session ────────────────────────────────────
      selectedRatee:        null,  // { id, full_name }
      selectedPeriod:       null,  // { id, label, start_date, end_date }
      selectedRelationship: null,  // 'subordinate' | 'superior' | 'peer'
      dateEvaluated:        null,  // pre-filled with today, editable

      // ── In-Progress Answers ───────────────────────────────
      // Shape: { [question_id]: { score: number | null, is_na: boolean } }
      answers: {},

      // ── Actions ───────────────────────────────────────────
      setRater: (rater, token) => set({ rater, token }),
      setSelectedRatee: (ratee) => set({ selectedRatee: ratee }),
      setSelectedPeriod: (period) => set({ selectedPeriod: period }),

      setAnswer: (questionId, score, isNa = false) =>
        set((state) => ({
          answers: {
            ...state.answers,
            [questionId]: { score: isNa ? null : score, is_na: isNa },
          },
        })),

      resetSurvey: () =>
        set({ selectedRatee: null, selectedPeriod: null, selectedRelationship: null, dateEvaluated: null, answers: {} }),

      logout: () =>
        set({ rater: null, token: null, selectedRatee: null,
              selectedPeriod: null, selectedRelationship: null, dateEvaluated: null, answers: {} }),
    }),
    {
      name: "pvp-survey-store",
      storage: createJSONStorage(() => sessionStorage), // rehydrates on refresh
    }
  )
);

export default useSurveyStore;