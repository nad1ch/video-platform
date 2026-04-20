export type NadleFeedback = 'correct' | 'present' | 'absent'

export declare function wordGraphemeCount(s: string): number

export declare function computeFeedback(answer: string, guess: string): NadleFeedback[]
