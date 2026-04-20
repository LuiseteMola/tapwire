import type { FeedItem } from '../../../types';
import { Section } from '../../common';
import { BodyBlock } from '../../common';

export function PayloadTab({ item }: { item: FeedItem }) {
  const capture = item.capture;
  if (!capture) {
    return null;
  }

  return (
    <Section title="Request Body"><BodyBlock value={capture.requestBody} /></Section>
  );
}
