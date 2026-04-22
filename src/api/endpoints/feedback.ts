import { apiClient } from '../client';
import type { FeedbackRead, FeedbackSuggestion } from '../types';

export async function submitFeatureSuggestion(
  payload: FeedbackSuggestion
): Promise<FeedbackRead> {
  const { data } = await apiClient.post<FeedbackRead>('/feedback/feature-suggestions/', payload);
  return data;
}
