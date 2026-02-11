import React from 'react';
import { CalendarEvent, User } from '../types';
import { EventBadge } from './EventBadge';

const EXAMPLE_USERS: User[] = [
  {
    id: 'layout-test-u1',
    name: 'Ebru Ay Çok Uzun Soyad Testi',
    email: 'ebru.ay@example.com',
    emoji: '👩‍💻'
  },
  {
    id: 'layout-test-u2',
    name: 'Mert',
    email: 'mert@example.com',
    emoji: '👨‍💼'
  }
];

const EXAMPLE_EVENTS: CalendarEvent[] = [
  {
    id: 'layout-test-e1',
    date: new Date(),
    title: 'Çok Uzun Kampanya Adı: Vakıfbank Bono Halka Arzı Dijital Lansman ve Süreç Takibi',
    urgency: 'Very High',
    assigneeId: 'layout-test-u1',
    note: 'Not var',
    status: 'Planlandı'
  },
  {
    id: 'layout-test-e2',
    date: new Date(),
    title: 'Dar Hücrede Kritik Rozet Testi',
    urgency: 'Very High',
    assigneeId: 'layout-test-u2',
    status: 'Planlandı'
  },
  {
    id: 'layout-test-e3',
    date: new Date(),
    title: 'Rozetsiz Normal Kart (Orta)',
    urgency: 'Medium',
    assigneeId: 'layout-test-u1',
    status: 'Planlandı'
  }
];

const findUser = (assigneeId?: string) => EXAMPLE_USERS.find((user) => user.id === assigneeId);

export const EventBadgeLayoutExamples: React.FC = () => {
  return (
    <div className="mb-4 p-3 rounded-2xl border border-violet-200 bg-violet-50/40 dark:border-violet-700/40 dark:bg-violet-900/10">
      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-2">
        Badge Layout Test Örnekleri (`?badgeLayoutTest=1`)
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="max-w-[280px]">
          <EventBadge
            event={EXAMPLE_EVENTS[0]}
            user={findUser(EXAMPLE_EVENTS[0].assigneeId)}
            onClick={() => {}}
          />
        </div>
        <div className="max-w-[180px]">
          <EventBadge
            event={EXAMPLE_EVENTS[1]}
            user={findUser(EXAMPLE_EVENTS[1].assigneeId)}
            onClick={() => {}}
          />
        </div>
        <div className="max-w-[150px]">
          <EventBadge
            event={EXAMPLE_EVENTS[2]}
            user={findUser(EXAMPLE_EVENTS[2].assigneeId)}
            onClick={() => {}}
          />
        </div>
      </div>
    </div>
  );
};
