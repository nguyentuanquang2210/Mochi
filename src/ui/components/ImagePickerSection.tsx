import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from './Icons';
import type { ImageItem } from '../../domain/types';

interface ImagePickerSectionProps {
  images: ImageItem[];
  selectedImageUrl: string | null;
  loading: boolean;
  onSelectImage: (image: ImageItem | null) => void;
  onRetrySearch?: () => void;
}

export function ImagePickerSection({
  images,
  selectedImageUrl,
  loading,
  onSelectImage,
  onRetrySearch
}: ImagePickerSectionProps) {
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#2563EB" />
        <Text style={styles.loadingText}>Đang tự động tìm ảnh minh họa...</Text>
      </View>
    );
  }

  if (images.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithIcon}>
          <Feather name="image" size={14} color="#4B5563" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Hình ảnh minh họa</Text>
        </View>

        {selectedImageUrl && (
          <TouchableOpacity onPress={() => onSelectImage(null)} style={styles.removeBtn}>
            <Text style={styles.removeText}>Bỏ chọn ảnh</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollList}
      >
        {images.map(img => {
          const isSelected = selectedImageUrl === img.thumbnailUrl || selectedImageUrl === img.url;
          return (
            <TouchableOpacity
              key={img.id}
              activeOpacity={0.8}
              onPress={() => onSelectImage(isSelected ? null : img)}
              style={[styles.imageCard, isSelected && styles.imageCardSelected]}
            >
              <Image source={{ uri: img.thumbnailUrl }} style={styles.thumbnail} resizeMode="cover" />
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4
  },
  loadingText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 2
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151'
  },
  removeBtn: {
    paddingVertical: 2,
    paddingHorizontal: 6
  },
  removeText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500'
  },
  scrollList: {
    paddingRight: 10,
    gap: 10
  },
  imageCard: {
    width: 88,
    height: 72,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    position: 'relative'
  },
  imageCardSelected: {
    borderColor: '#10B981',
    borderWidth: 2.5
  },
  thumbnail: {
    width: '100%',
    height: '100%'
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  }
});

