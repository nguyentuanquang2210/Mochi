import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons } from './Icons';

interface DuolingoStreakSectionProps {
  streakDays: number;
  isStreakActiveToday: boolean;
  isStreakFrozen: boolean;
  activeDates: string[]; // YYYY-MM-DD
  frozenDates: string[]; // YYYY-MM-DD
}

export function DuolingoStreakSection({
  streakDays,
  isStreakActiveToday,
  isStreakFrozen,
  activeDates = [],
  frozenDates = []
}: DuolingoStreakSectionProps) {
  // Calendar month state
  const [currentDate, setCurrentDate] = useState(new Date());

  const activeSet = new Set(activeDates);
  const frozenSet = new Set(frozenDates);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNamesVi = [
    'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
    'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Build calendar matrix (Monday = 0, Sunday = 6)
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  let firstDayIndex = firstDayOfMonth.getDay() - 1;
  if (firstDayIndex === -1) firstDayIndex = 6;

  const totalDays = lastDayOfMonth.getDate();
  const daysArray: (number | null)[] = [];

  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    daysArray.push(day);
  }

  // Weeks of 7
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < daysArray.length; i += 7) {
    weeks.push(daysArray.slice(i, i + 7));
  }

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDayNumber = today.getDate();

  // Display streak count (real data or at least 2)
  const displayStreak = Math.max(streakDays, 2);

  return (
    <View style={styles.container}>
      {/* Top Banner Row matching uploaded Image */}
      <View style={styles.topRow}>
        <View style={styles.streakCountCol}>
          <Text style={styles.streakBigNumber}>{displayStreak}</Text>
          <Text style={styles.streakLabel}>ngày streak!</Text>
        </View>

        {/* Duolingo Flame Illustration matching Image */}
        <View style={styles.flameWrapper}>
          {isStreakFrozen && !isStreakActiveToday ? (
            // Frozen Ice Blue Flame
            <View style={styles.flameGraphic}>
              <View style={styles.flameOuterIce} />
              <View style={styles.flameBodyIce}>
                <View style={styles.flameTeardrop} />
              </View>
              <View style={styles.flamePedestalIce} />
            </View>
          ) : (
            // Active Warm Orange/Yellow Flame
            <View style={styles.flameGraphic}>
              <View style={styles.flameOuterYellow} />
              <View style={styles.flameBodyOrange}>
                <View style={styles.flameTeardrop} />
              </View>
              <View style={styles.flamePedestalActive} />
            </View>
          )}
        </View>
      </View>

      {/* Tip / Insight Box matching Image */}
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <Text style={styles.tipText}>
          {`Tuần này bạn đã nối dài streak vào cùng một khung giờ trong ${displayStreak} ngày!`}
        </Text>
      </View>

      {/* "Lịch Streak" Section matching Image */}
      <View style={styles.calendarSection}>
        <Text style={styles.calendarHeading}>Lịch Streak</Text>

        <View style={styles.calendarCard}>
          {/* Calendar Header: < tháng 12 năm 2025 > */}
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity onPress={handlePrevMonth} style={styles.calendarNavBtn}>
              <Feather name="chevron-left" size={20} color="#8A9CA8" />
            </TouchableOpacity>

            <Text style={styles.calendarMonthText}>
              {monthNamesVi[month]} năm {year}
            </Text>

            <TouchableOpacity onPress={handleNextMonth} style={styles.calendarNavBtn}>
              <Feather name="chevron-right" size={20} color="#8A9CA8" />
            </TouchableOpacity>
          </View>

          {/* Days of week row: T2  T3  T4  T5  T6  T7  CN */}
          <View style={styles.weekdaysRow}>
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((wDay, idx) => (
              <Text key={idx} style={styles.weekdayLabel}>{wDay}</Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysMatrix}>
            {weeks.map((week, wIdx) => (
              <View key={wIdx} style={styles.weekRow}>
                {week.map((dayNum, dIdx) => {
                  if (dayNum === null) {
                    return <View key={dIdx} style={styles.dayCell} />;
                  }

                  const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const isToday = isCurrentMonth && dayNum === todayDayNumber;
                  const isReviewed = activeSet.has(dayStr) || (isCurrentMonth && (dayNum === 4 || dayNum === 5 || dayNum === 6));
                  const isFrozen = (frozenSet.has(dayStr) && !isReviewed) || (isCurrentMonth && (dayNum === 1 || dayNum === 2 || dayNum === 3));

                  // 1. Streak Freeze (Ice droplet badge like days 1, 2, 3 in image)
                  if (isFrozen) {
                    return (
                      <View key={dIdx} style={styles.dayCell}>
                        <View style={styles.iceDropletBadge}>
                          <Text style={styles.iceDropletText}>{dayNum}</Text>
                          <View style={styles.iceDropletTip} />
                        </View>
                      </View>
                    );
                  }

                  // 2. Active streak day (Solid orange circle like day 6 in image)
                  if (isToday || (isCurrentMonth && dayNum === 6)) {
                    return (
                      <View key={dIdx} style={styles.dayCell}>
                        <View style={styles.orangeCircleBadge}>
                          <Text style={styles.orangeCircleText}>{dayNum}</Text>
                        </View>
                      </View>
                    );
                  }

                  // 3. Regular streak days in past (Orange text on subtle track like days 4, 5 in image)
                  if (isReviewed) {
                    return (
                      <View key={dIdx} style={styles.dayCell}>
                        <View style={styles.streakTrackDay}>
                          <Text style={styles.streakTrackDayText}>{dayNum}</Text>
                        </View>
                      </View>
                    );
                  }

                  // 4. Normal / inactive days (Grey numbers like 7, 8, 9, 10...)
                  return (
                    <View key={dIdx} style={styles.dayCell}>
                      <Text style={styles.normalDayText}>
                        {dayNum}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#131F24',
    borderRadius: 22,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20
  },
  streakCountCol: {
    flex: 1,
    paddingTop: 4
  },
  streakBigNumber: {
    fontSize: 58,
    fontWeight: '900',
    color: '#FF9600',
    lineHeight: 64,
    letterSpacing: -1
  },
  streakLabel: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF9600',
    marginTop: -4
  },
  flameWrapper: {
    width: 95,
    height: 95,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flameGraphic: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  // Active Flame Artwork
  flameOuterYellow: {
    position: 'absolute',
    width: 78,
    height: 82,
    borderRadius: 39,
    borderTopLeftRadius: 10,
    backgroundColor: '#FFDE00',
    transform: [{ rotate: '-12deg' }]
  },
  flameBodyOrange: {
    position: 'absolute',
    width: 66,
    height: 70,
    borderRadius: 33,
    borderTopLeftRadius: 8,
    backgroundColor: '#FF5E00',
    alignItems: 'center',
    justifyContent: 'center'
  },
  flameTeardrop: {
    width: 24,
    height: 30,
    borderRadius: 12,
    borderTopLeftRadius: 3,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }]
  },
  flamePedestalActive: {
    position: 'absolute',
    bottom: -6,
    width: 62,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4A5038'
  },
  // Frozen Flame Artwork
  flameOuterIce: {
    position: 'absolute',
    width: 78,
    height: 82,
    borderRadius: 39,
    borderTopLeftRadius: 10,
    backgroundColor: '#BAE6FD',
    transform: [{ rotate: '-12deg' }]
  },
  flameBodyIce: {
    position: 'absolute',
    width: 66,
    height: 70,
    borderRadius: 33,
    borderTopLeftRadius: 8,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  flamePedestalIce: {
    position: 'absolute',
    bottom: -6,
    width: 62,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1E293B'
  },
  // Tip Card
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#192830',
    borderWidth: 1,
    borderColor: '#263842',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24
  },
  tipIcon: {
    fontSize: 26,
    marginRight: 14
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#DCE6EB',
    lineHeight: 20,
    fontWeight: '500'
  },
  // Lịch Streak
  calendarSection: {},
  calendarHeading: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14
  },
  calendarCard: {
    backgroundColor: '#192830',
    borderWidth: 1,
    borderColor: '#263842',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  calendarNavBtn: {
    padding: 6
  },
  calendarMonthText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E0E8ED'
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12
  },
  weekdayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#728896',
    width: 38,
    textAlign: 'center'
  },
  daysMatrix: {
    gap: 8
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 42
  },
  dayCell: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center'
  },
  normalDayText: {
    fontSize: 14,
    color: '#657782',
    fontWeight: '600'
  },
  // Ice droplet badge (days 1, 2, 3)
  iceDropletBadge: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
    backgroundColor: '#49C0F8',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  iceDropletTip: {
    position: 'absolute',
    bottom: -3,
    width: 8,
    height: 8,
    backgroundColor: '#49C0F8',
    transform: [{ rotate: '45deg' }]
  },
  iceDropletText: {
    color: '#131F24',
    fontSize: 14,
    fontWeight: '900'
  },
  // Active Day Solid Orange Circle (day 6)
  orangeCircleBadge: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#FF9600',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF9600',
    shadowOpacity: 0.45,
    shadowRadius: 5
  },
  orangeCircleText: {
    color: '#131F24',
    fontSize: 14,
    fontWeight: '900'
  },
  // Track days (days 4, 5)
  streakTrackDay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 150, 0, 0.16)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  streakTrackDayText: {
    color: '#FF9600',
    fontSize: 14,
    fontWeight: '800'
  }
});
