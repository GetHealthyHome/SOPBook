import { useMemo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  Path,
  Text as SkiaText,
  useImage,
} from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { buildStrokePath } from '@/annotation/flatten';
import { computeContainRect, scalarToPixels, toNormalized } from '@/annotation/geometry';
import { makeMonoFont } from '@/render/skiaFont';
import type { Annotation, AnnotationTool, NormalizedPoint } from '@/annotation/types';

interface AnnotationCanvasProps {
  imageUri: string;
  annotations: Annotation[];
  /** The stroke being drawn right now, rendered but not yet committed. */
  liveStroke: { color: string; width: number; points: NormalizedPoint[] } | null;
  tool: AnnotationTool;
  onStrokeStart: (point: NormalizedPoint) => void;
  onStrokeMove: (point: NormalizedPoint) => void;
  onStrokeEnd: () => void;
  onTapForText: (point: NormalizedPoint) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  containerWidth: number;
  containerHeight: number;
}

/**
 * The photo with its annotations, and the gesture surface for adding more.
 *
 * All coordinates cross the boundary normalized (0..1 in image space), never in
 * screen points. The letterbox rect is resolved here and nowhere else, so the
 * rest of the app never has to know how the photo is fitted on screen.
 */
export function AnnotationCanvas({
  imageUri,
  annotations,
  liveStroke,
  tool,
  onStrokeStart,
  onStrokeMove,
  onStrokeEnd,
  onTapForText,
  onLayout,
  containerWidth,
  containerHeight,
}: AnnotationCanvasProps) {
  const image = useImage(imageUri);

  const rect = useMemo(
    () =>
      computeContainRect(
        containerWidth,
        containerHeight,
        image?.width() ?? 1,
        image?.height() ?? 1,
      ),
    [containerWidth, containerHeight, image],
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        // Start drawing on the first pixel of movement; the default activation
        // distance makes short marks feel like they were ignored.
        .minDistance(0)
        .enabled(tool === 'draw')
        .onBegin((event) => {
          runOnJS(onStrokeStart)(toNormalized(event.x, event.y, rect));
        })
        .onUpdate((event) => {
          runOnJS(onStrokeMove)(toNormalized(event.x, event.y, rect));
        })
        .onFinalize(() => {
          runOnJS(onStrokeEnd)();
        }),
    [tool, rect, onStrokeStart, onStrokeMove, onStrokeEnd],
  );

  const tap = useMemo(
    () =>
      Gesture.Tap()
        .enabled(tool === 'text')
        .onEnd((event) => {
          runOnJS(onTapForText)(toNormalized(event.x, event.y, rect));
        }),
    [tool, rect, onTapForText],
  );

  const gesture = useMemo(() => Gesture.Exclusive(pan, tap), [pan, tap]);

  const toPixels = useMemo(
    () => (point: NormalizedPoint) => ({
      x: rect.x + point.x * rect.width,
      y: rect.y + point.y * rect.height,
    }),
    [rect],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.container} onLayout={onLayout} collapsable={false}>
        <Canvas style={StyleSheet.absoluteFill}>
          {image ? (
            <SkiaImage image={image} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fit="fill" />
          ) : null}

          <Group>
            {annotations.map((annotation) =>
              annotation.kind === 'stroke' ? (
                <Path
                  key={annotation.id}
                  path={buildStrokePath(annotation.points, toPixels)}
                  color={annotation.color}
                  style="stroke"
                  strokeWidth={scalarToPixels(annotation.width, rect.width, rect.height)}
                  strokeCap="round"
                  strokeJoin="round"
                />
              ) : (
                <SkiaText
                  key={annotation.id}
                  x={rect.x + annotation.position.x * rect.width}
                  y={
                    rect.y +
                    annotation.position.y * rect.height +
                    scalarToPixels(annotation.fontSize, rect.width, rect.height)
                  }
                  text={annotation.text}
                  color={annotation.color}
                  font={makeMonoFont(scalarToPixels(annotation.fontSize, rect.width, rect.height))}
                />
              ),
            )}

            {liveStroke && liveStroke.points.length > 0 ? (
              <Path
                path={buildStrokePath(liveStroke.points, toPixels)}
                color={liveStroke.color}
                style="stroke"
                strokeWidth={scalarToPixels(liveStroke.width, rect.width, rect.height)}
                strokeCap="round"
                strokeJoin="round"
              />
            ) : null}
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
