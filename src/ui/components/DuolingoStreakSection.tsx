import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather } from './Icons';

interface DuolingoStreakSectionProps {
  streakDays: number;
  isStreakActiveToday: boolean;
  isStreakFrozen: boolean;
  activeDates: string[]; // YYYY-MM-DD
  frozenDates: string[]; // YYYY-MM-DD
}

interface SelectedDayInfo {
  dayNum: number;
  dateStr: string;
  status: 'studied' | 'missed' | 'future';
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
  const [selectedDay, setSelectedDay] = useState<SelectedDayInfo | null>(null);

  const activeSet = new Set(activeDates);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNamesVi = [
    'tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
    'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
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

  // Group into weeks of 7
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < daysArray.length; i += 7) {
    const chunk = daysArray.slice(i, i + 7);
    while (chunk.length < 7) {
      chunk.push(null);
    }
    weeks.push(chunk);
  }

  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0).getTime();

  return (
    <View style={styles.container}>
      {/* Top Banner Row */}
      <View style={styles.topRow}>
        <View style={styles.streakCountCol}>
          <Text style={styles.streakBigNumber}>{streakDays}</Text>
          <Text style={styles.streakLabel}>ngày streak!</Text>
        </View>

        {/* Flame Artwork */}
        <View style={styles.flameWrapper}>
          {streakDays === 0 ? (
            // Inactive flame for 0 days
            <View style={styles.flameGraphic}>
              <View style={styles.flameOuterMuted} />
              <View style={styles.flameBodyMuted}>
                <View style={styles.flameTeardropMuted} />
              </View>
              <View style={styles.flamePedestalMuted} />
            </View>
          ) : isStreakFrozen && !isStreakActiveToday ? (
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

      {/* Motivational Tip Card */}
      <View style={styles.tipCard}>
        <Text style={styles.tipIcon}>💡</Text>
        <Text style={styles.tipText}>
          {streakDays === 0
            ? 'Hãy hoàn thành 1 lượt ôn tập hôm nay để thắp sáng ngọn lửa streak đầu tiên của bạn!'
            : isStreakActiveToday
            ? `Tuyệt vời! Bạn đã duy trì chuỗi học ${streakDays} ngày liên tiếp. Cố gắng phát huy nhé!`
            : `Hôm nay bạn chưa ôn tập. Hãy học ngay để bảo vệ chuỗi streak ${streakDays} ngày của bạn!`}
        </Text>
      </View>

      {/* "Lịch Streak" Section */}
      <View style={styles.calendarSection}>
        <Text style={styles.calendarHeading}>Lịch Streak</Text>

        <View style={styles.calendarCard}>
          {/* Calendar Header: < tháng M năm YYYY > */}
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
                    return <View key={dIdx} style={styles.dayColPlaceholder} />;
                  }

                  const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const cellMidnight = new Date(year, month, dayNum, 0, 0, 0, 0).getTime();
                  const isToday = cellMidnight === todayMidnight;
                  const isFuture = cellMidnight > todayMidnight;
                  const isStudied = activeSet.has(dayStr);
                  const isSelected = selectedDay?.dayNum === dayNum;

                  // 1. Future day (not reached yet)
                  if (isFuture) {
                    return (
                      <TouchableOpacity
                        key={dIdx}
                        activeOpacity={0.7}
                        style={styles.dayCol}
                        onPress={() => setSelectedDay({ dayNum, dateStr: dayStr, status: 'future' })}
                      >
                        <View style={[styles.dayCircleWrapper, isSelected && styles.selectedCircleRing]}>
                          <Text style={styles.futureDayText}>{dayNum}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  // 2. Day studied -> Orange circle or connected capsule for 2+ consecutive days
                  if (isStudied) {
                    // Check if previous column in this same week row was studied yesterday
                    let hasPrev = false;
                    if (dIdx > 0 && week[dIdx - 1] !== null) {
                      const prevDayNum = week[dIdx - 1]!;
                      if (prevDayNum === dayNum - 1) {
                        const prevStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(prevDayNum).padStart(2, '0')}`;
                        if (activeSet.has(prevStr)) hasPrev = true;
                      }
                    }

                    // Check if next column in this same week row is studied tomorrow
                    let hasNext = false;
                    if (dIdx < 6 && week[dIdx + 1] !== null) {
                      const nextDayNum = week[dIdx + 1]!;
                      if (nextDayNum === dayNum + 1) {
                        const nextStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(nextDayNum).padStart(2, '0')}`;
                        if (activeSet.has(nextStr)) hasNext = true;
                      }
                    }

                    return (
                      <TouchableOpacity
                        key={dIdx}
                        activeOpacity={0.7}
                        style={styles.dayCol}
                        onPress={() => setSelectedDay({ dayNum, dateStr: dayStr, status: 'studied' })}
                      >
                        {/* Horizontal connector to previous day in streak */}
                        {hasPrev && <View style={styles.streakConnectorLeft} />}

                        {/* Horizontal connector to next day in streak */}
                        {hasNext && <View style={styles.streakConnectorRight} />}

                        {/* Orange Badge */}
                        <View
                          style={[
                            styles.orangeCircleBadge,
                            isToday && styles.todayBadgeHighlight,
                            isSelected && styles.selectedCircleRing
                          ]}
                        >
                          <Text style={styles.orangeCircleText}>{dayNum}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  // 3. Day NOT studied (past or today) -> Blue circle (Màu xanh dương)
                  return (
                    <TouchableOpacity
                      key={dIdx}
                      activeOpacity={0.7}
                      style={styles.dayCol}
                      onPress={() => setSelectedDay({ dayNum, dateStr: dayStr, status: 'missed' })}
                    >
                      <View
                        style={[
                          styles.blueCircleBadge,
                          isToday && styles.todayBadgeHighlight,
                          isSelected && styles.selectedCircleRing
                        ]}
                      >
                        <Text style={styles.blueCircleText}>{dayNum}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>

          {/* Selected Day Info Popup Card */}
          {selectedDay && (
            <View style={styles.selectedDayCard}>
              <View style={styles.selectedDayHeader}>
                <Text style={styles.selectedDayTitle}>
                  {`Ngày ${selectedDay.dayNum} ${monthNamesVi[month]} năm ${year}`}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedDay(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Feather name="x" size={16} color="#8A9CA8" />
                </TouchableOpacity>
              </View>

              <View style={styles.selectedDayStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    selectedDay.status === 'studied' && { backgroundColor: '#FF9600' },
                    selectedDay.status === 'missed' && { backgroundColor: '#38BDF8' },
                    selectedDay.status === 'future' && { backgroundColor: '#5A6E7B' }
                  ]}
                />
                <Text style={styles.selectedDayStatusText}>
                  {selectedDay.status === 'studied'
                    ? 'Đã học (nằm trong chuỗi ngày học)'
                    : selectedDay.status === 'missed'
                    ? 'Không học (chưa có bài ôn nào)'
                    : 'Chưa tới ngày này'}
                </Text>
              </View>
            </View>
          )}

          {/* Color Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={styles.legendCapsulePreview}>
                <View style={styles.legendCapsuleCircle} />
                <View style={styles.legendCapsuleBar} />
                <View style={styles.legendCapsuleCircle} />
              </View>
              <Text style={styles.legendLabel}>Đã học (chuỗi)</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendCircle, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.legendLabel}>Không học</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={[styles.legendCircle, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#5A6E7B' }]} />
              <Text style={styles.legendLabel}>Chưa tới</Text>
            </View>
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
    fontSize: 54,
    fontWeight: '900',
    color: '#FF9600',
    lineHeight: 60,
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
  // Inactive Flame Artwork (0 streak)
  flameOuterMuted: {
    position: 'absolute',
    width: 78,
    height: 82,
    borderRadius: 39,
    borderTopLeftRadius: 10,
    backgroundColor: '#334155',
    transform: [{ rotate: '-12deg' }]
  },
  flameBodyMuted: {
    position: 'absolute',
    width: 66,
    height: 70,
    borderRadius: 33,
    borderTopLeftRadius: 8,
    backgroundColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center'
  },
  flameTeardropMuted: {
    width: 24,
    height: 30,
    borderRadius: 12,
    borderTopLeftRadius: 3,
    backgroundColor: '#94A3B8',
    transform: [{ rotate: '45deg' }]
  },
  flamePedestalMuted: {
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
    paddingHorizontal: 8,
    paddingVertical: 16
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8
  },
  calendarNavBtn: {
    padding: 6
  },
  calendarMonthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E0E8ED'
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 10
  },
  weekdayLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#728896',
    textAlign: 'center'
  },
  daysMatrix: {
    gap: 6
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40
  },
  dayColPlaceholder: {
    flex: 1,
    height: 40
  },
  dayCol: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  dayCircleWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  futureDayText: {
    fontSize: 14,
    color: '#556874',
    fontWeight: '600'
  },
  // Consecutive Streak Capsule Connectors (Orange)
  streakConnectorLeft: {
    position: 'absolute',
    left: 0,
    width: '50%',
    top: 4,
    height: 32,
    backgroundColor: '#FF9600',
    zIndex: 1
  },
  streakConnectorRight: {
    position: 'absolute',
    right: 0,
    width: '50%',
    top: 4,
    height: 32,
    backgroundColor: '#FF9600',
    zIndex: 1
  },
  // Studied Day (Orange Circle)
  orangeCircleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF9600',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#FF9600',
    shadowOpacity: 0.35,
    shadowRadius: 4
  },
  orangeCircleText: {
    color: '#131F24',
    fontSize: 13,
    fontWeight: '800'
  },
  // Missed Day (Blue Circle - Xanh dương)
  blueCircleBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2
  },
  blueCircleText: {
    color: '#131F24',
    fontSize: 13,
    fontWeight: '800'
  },
  todayBadgeHighlight: {
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  selectedCircleRing: {
    borderWidth: 2,
    borderColor: '#FACC15'
  },
  // Selected Day Details Card
  selectedDayCard: {
    marginTop: 14,
    backgroundColor: '#131F24',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2B383E'
  },
  selectedDayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  selectedDayTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  selectedDayStatusRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  selectedDayStatusText: {
    fontSize: 13,
    color: '#DCE6EB',
    fontWeight: '500'
  },
  // Legend
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#263842'
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  legendCapsulePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 12
  },
  legendCapsuleCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF9600'
  },
  legendCapsuleBar: {
    width: 8,
    height: 10,
    backgroundColor: '#FF9600'
  },
  legendCircle: {
    width: 10,
    height: 10,
    borderRadius: 5
  },
  legendLabel: {
    fontSize: 12,
    color: '#8A9CA8',
    fontWeight: '600'
  }
});
