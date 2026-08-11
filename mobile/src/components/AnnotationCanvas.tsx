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
import { buildShapePath, buildStrokePath } from '@/annotation/flatten';
import { computeContainRect, scalarToPixels, toNormalized } from '@/annotation/geometry';
import { makeMonoFont } from '@/render/skiaFont';
import type {
  Annotation,
  AnnotationTool,
  NormalizedPoint,
  ShapeKind,
} from '@/annotation/types';

export interface LiveShape {
  shape: ShapeKind;
  color: string;
  width: number;
  start: NormalizedPoint;
  end: NormalizedPoint;
}

interface AnnotationCanvasProps {
  imageUri: string;
  annotations: Annotation[];
  /** The stroke being drawn right now, rendered but not yet committed. */
  liveStroke: { color: string; width: number; points: NormalizedPoint[] } | null;
  /** The shape being dragged right now, same deal. */
  liveShape: LiveShape | null;
  tool: AnnotationTool;
  onDragStart: (point: NormalizedPoint) => void;
  onDragMove: (point: NormalizedPoint) => void;
  onDragEnd: () => void;
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
  liveShape,
  tool,
  onDragStart,
  onDragMove,
  onDragEnd,
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
        // Every tool except text is drawn by dragging. The component stays
        // ignorant of which one — it reports points, the screen decides shape.
        .enabled(tool !== 'text')
        .onBegin((event) => {
          runOnJS(onDragStart)(toNormalized(event.x, event.y, rect));
        })
        .onUpdate((event) => {
          runOnJS(onDragMove)(toNormalized(event.x, event.y, rect));
        })
        .onFinalize(() => {
          runOnJS(onDragEnd)();
        }),
    [tool, rect, onDragStart, onDragMove, onDragEnd],
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
              ) : annotation.kind === 'shape' ? (
                <Path
                  key={annotation.id}
                  path={buildShapePath(
                    annotation.shape,
                    toPixels(annotation.start),
                    toPixels(annotation.end),
                    scalarToPixels(annotation.width, rect.width, rect.height),
                  )}
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

            {liveShape ? (
              <Path
                path={buildShapePath(
                  liveShape.shape,
                  toPixels(liveShape.start),
                  toPixels(liveShape.end),
                  scalarToPixels(liveShape.width, rect.width, rect.height),
                )}
                color={liveShape.color}
                style="stroke"
                strokeWidth={scalarToPixels(liveShape.width, rect.width, rect.height)}
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
