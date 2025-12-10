export function getTelemetryDateKey(date?: Date): string {
  const targetDate = date ?? new Date();
  const [datePart] = targetDate.toISOString().split('T');
  return datePart ?? '';
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getEventCategory(eventType: string): string {
  if (eventType.startsWith('view_')) return 'View';
  if (eventType.startsWith('click_')) return 'Click';
  if (eventType.startsWith('toggle_')) return 'Toggle';
  if (
    eventType.startsWith('drawing_') ||
    eventType === 'first_pixel_drawn' ||
    eventType === 'select_extended_color'
  )
    return 'Drawing';
  if (eventType.startsWith('post_')) return 'Post';
  return 'Other';
}

export function getEventCount(
  telemetryData: Record<string, number> | undefined,
  postType: string,
  eventType: string
): number {
  if (!telemetryData) return 0;
  const key = `${postType}:${eventType}`;
  return telemetryData[key] ?? 0;
}
