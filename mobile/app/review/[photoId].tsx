import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AnnotationCanvas } from '@/components/AnnotationCanvas';
import { flattenAnnotations } from '@/annotation/flatten';
import {
  DEFAULT_TEXT_SIZE,
  MARKER_COLORS,
  STROKE_WIDTHS,
  type Annotation,
  type AnnotationTool,
  type NormalizedPoint,
} from '@/annotation/types';
import { useCaptureStore } from '@/state';
import { deleteFile, getFileSize } from '@/storage/photoFiles';
import { HIT_TARGET, palette, radius, spacing, typography } from '@/theme';
import { PRESET_PHOTO_TAGS, type PhotoTag } from '@/types';
import { newId } from '@/utils/id';
import { logger } from '@/utils/logger';

/**
 * Tag, annotate, save.
 *
 * Ordering on this screen is deliberate: tags sit above the toolbar because
 * tagging is the step that must not be skipped (it is what makes the photo
 * findable later), while annotation is optional. The Save button stays enabled
 * with zero annotations — an un-annotated stamped photo is still a complete,
 * useful record.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const draft = useCaptureStore((state) => state.draft);
  const toggleTag = useCaptureStore((state) => state.toggleTag);
  const setCaption = useCaptureStore((state) => state.setCaption);
  const commitDraft = useCaptureStore((state) => state.commitDraft);
  const discardDraft = useCaptureStore((state) => state.discardDraft);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [liveStroke, setLiveStroke] = useState<{
    color: string;
    width: number;
    points: NormalizedPoint[];
  } | null>(null);

  const [tool, setTool] = useState<AnnotationTool>('draw');
  const [color, setColor] = useState<string>(MARKER_COLORS[0].value);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[1].value);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const [pendingTextPoint, setPendingTextPoint] = useState<NormalizedPoint | null>(null);
  const [textDraft, setTextDraft] = useState('');

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }, []);

  const onStrokeStart = useCallback(
    (point: NormalizedPoint) => setLiveStroke({ color, width: strokeWidth, points: [point] }),
    [color, strokeWidth],
  );

  const onStrokeMove = useCallback((point: NormalizedPoint) => {
    setLiveStroke((current) =>
      current ? { ...current, points: [...current.points, point] } : current,
    );
  }, []);

  const onStrokeEnd = useCallback(() => {
    setLiveStroke((current) => {
      if (current && current.points.length > 0) {
        setAnnotations((existing) => [
          ...existing,
          { id: newId(), kind: 'stroke', color: current.color, width: current.width, points: current.points },
        ]);
        void Haptics.selectionAsync();
      }
      return null;
    });
  }, []);

  const onTapForText = useCallback((point: NormalizedPoint) => {
    setPendingTextPoint(point);
    setTextDraft('');
  }, []);

  const commitText = useCallback(() => {
    const trimmed = textDraft.trim();
    if (pendingTextPoint && trimmed) {
      setAnnotations((existing) => [
        ...existing,
        {
          id: newId(),
          kind: 'text',
          color,
          text: trimmed,
          position: pendingTextPoint,
          fontSize: DEFAULT_TEXT_SIZE,
        },
      ]);
    }
    setPendingTextPoint(null);
    setTextDraft('');
  }, [color, pendingTextPoint, textDraft]);

  const undo = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAnnotations((existing) => existing.slice(0, -1));
  }, []);

  const onSave = useCallback(async () => {
    if (!draft || isSaving) return;
    setIsSaving(true);

    try {
      let finalUri = draft.localUri;

      if (annotations.length > 0) {
        // New file rather than in-place, so a crash mid-encode cannot destroy
        // the stamped original. The old file is removed only after the swap.
        const flattenedUri = `${draft.localUri.replace(/\.jpg$/, '')}-annotated.jpg`;
        const result = await flattenAnnotations({
          sourceUri: draft.localUri,
          destinationUri: flattenedUri,
          annotations,
        });
        finalUri = result.uri;
        await deleteFile(draft.localUri);
      }

      await commitDraft(finalUri, await getFileSize(finalUri));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace(`/job/${draft.jobId}`);
    } catch (error) {
      logger.error('review.save_failed', { error: String(error) });
      Alert.alert('Could not save photo', String(error));
      setIsSaving(false);
    }
  }, [annotations, commitDraft, draft, isSaving, router]);

  const onDiscard = useCallback(() => {
    Alert.alert('Discard photo?', 'The photo and anything drawn on it will be deleted.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          const jobId = draft?.jobId;
          await discardDraft();
          router.replace(jobId ? `/job/${jobId}` : '/');
        },
      },
    ]);
  }, [discardDraft, draft?.jobId, router]);

  const tags = useMemo<PhotoTag[]>(() => draft?.tags ?? [], [draft?.tags]);

  if (!draft) {
    return (
      <SafeAreaView style={styles.missing}>
        <Text style={styles.missingLabel}>This photo is no longer available.</Text>
        <Pressable onPress={() => router.replace('/')} style={styles.missingButton}>
          <Text style={styles.missingButtonLabel}>Back to jobs</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onDiscard} hitSlop={12} accessibilityRole="button">
          <Text style={styles.discard}>Discard</Text>
        </Pressable>
        <Pressable
          onPress={undo}
          disabled={annotations.length === 0}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Undo last annotation"
        >
          <Text style={[styles.undo, annotations.length === 0 && styles.disabled]}>Undo</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={isSaving} hitSlop={12} accessibilityRole="button">
          {isSaving ? <ActivityIndicator color={palette.blue} /> : <Text style={styles.save}>Save</Text>}
        </Pressable>
      </View>

      <AnnotationCanvas
        imageUri={draft.localUri}
        annotations={annotations}
        liveStroke={liveStroke}
        tool={tool}
        onStrokeStart={onStrokeStart}
        onStrokeMove={onStrokeMove}
        onStrokeEnd={onStrokeEnd}
        onTapForText={onTapForText}
        onLayout={onLayout}
        containerWidth={size.width}
        containerHeight={size.height}
      />

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {PRESET_PHOTO_TAGS.map((tag) => {
            const active = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => {
                  void Haptics.selectionAsync();
                  toggleTag(tag);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tagChip, active && styles.tagChipActive]}
              >
                <Text style={[styles.tagLabel, active && styles.tagLabelActive]}>{tag}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <TextInput
          value={draft.caption ?? ''}
          onChangeText={setCaption}
          placeholder="Add a note (optional)"
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.caption}
        />

        <View style={styles.toolRow}>
          <View style={styles.toolGroup}>
            <ToolButton label="Draw" active={tool === 'draw'} onPress={() => setTool('draw')} />
            <ToolButton label="Text" active={tool === 'text'} onPress={() => setTool('text')} />
          </View>

          <View style={styles.toolGroup}>
            {MARKER_COLORS.map((marker) => (
              <Pressable
                key={marker.value}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setColor(marker.value);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${marker.name} marker`}
                accessibilityState={{ selected: color === marker.value }}
                style={[
                  styles.swatch,
                  { backgroundColor: marker.value },
                  color === marker.value && styles.swatchActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.toolGroup}>
            {STROKE_WIDTHS.map((option) => (
              <Pressable
                key={option.name}
                onPress={() => setStrokeWidth(option.value)}
                accessibilityRole="button"
                accessibilityLabel={`${option.name} stroke`}
                accessibilityState={{ selected: strokeWidth === option.value }}
                style={[styles.widthButton, strokeWidth === option.value && styles.widthButtonActive]}
              >
                <View
                  style={{
                    width: 20,
                    height: Math.max(2, option.value * 260),
                    borderRadius: 4,
                    backgroundColor: '#FFFFFF',
                  }}
                />
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Modal visible={pendingTextPoint !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add text</Text>
            <TextInput
              value={textDraft}
              onChangeText={setTextDraft}
              autoFocus
              placeholder="e.g. Gap sealed here"
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.modalInput}
              onSubmitEditing={commitText}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setPendingTextPoint(null)} style={styles.modalButton}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={commitText} style={styles.modalButton}>
                <Text style={styles.modalConfirm}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ToolButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.toolButton, active && styles.toolButtonActive]}
    >
      <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Dark chrome throughout: the photo is the subject, and a light UI around it
  // skews how a tech judges exposure and contrast in the image.
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  discard: { ...typography.headline, color: palette.red },
  undo: { ...typography.headline, color: '#FFFFFF' },
  save: { ...typography.headline, color: palette.blue, fontWeight: '700' },
  disabled: { opacity: 0.35 },
  controls: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.md },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  tagChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.12)',
    minHeight: 36,
    justifyContent: 'center',
  },
  tagChipActive: { backgroundColor: palette.blue },
  tagLabel: { ...typography.footnote, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  tagLabelActive: { color: '#FFFFFF' },
  caption: {
    ...typography.callout,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: HIT_TARGET,
  },
  toolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  toolGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toolButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toolButtonActive: { backgroundColor: '#FFFFFF' },
  toolLabel: { ...typography.footnote, color: 'rgba(255,255,255,0.85)', fontWeight: '600' },
  toolLabelActive: { color: palette.ink },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  swatchActive: { borderColor: '#FFFFFF', borderWidth: 3, transform: [{ scale: 1.15 }] },
  widthButton: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  widthButtonActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#1B1D21',
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { ...typography.title3, color: '#FFFFFF' },
  modalInput: {
    ...typography.body,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: HIT_TARGET,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg },
  modalButton: { minHeight: HIT_TARGET, justifyContent: 'center', paddingHorizontal: spacing.md },
  modalCancel: { ...typography.headline, color: 'rgba(255,255,255,0.7)' },
  modalConfirm: { ...typography.headline, color: palette.blue, fontWeight: '700' },
  missing: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  missingLabel: { ...typography.subheadline, color: 'rgba(255,255,255,0.7)' },
  missingButton: {
    paddingHorizontal: spacing.xl,
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: palette.blue,
  },
  missingButtonLabel: { ...typography.headline, color: '#FFFFFF' },
});
