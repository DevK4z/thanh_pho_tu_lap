/* Hậu kỳ cho thành phố 3D (chỉ ở chất lượng Đẹp, tải riêng khi cần):
   - Ambient occlusion (N8AO): bóng tối mềm ở góc khuất, chân tường, khe giữa các khối, làm khối nhà có chiều sâu.
   - Bloom: vật sáng (đèn, cửa sổ ban đêm, mặt trời, đèn tháp) tỏa quầng. Ngưỡng và độ mạnh chạy theo chu kỳ ngày đêm:
     ban ngày ngưỡng cao để tường trắng dưới nắng không bị lóa, ban đêm ngưỡng thấp để cửa sổ, đèn đường tỏa sáng.
   - Làm tối viền khung hình nhẹ, tone mapping ACES (khi có hậu kỳ, renderer không tự tone map lúc vẽ vào bộ đệm). */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode, type BloomEffect } from 'postprocessing';
import { glow } from './parts';

export default function PostFX() {
  const bloom = useRef<BloomEffect>(null);
  useFrame(() => {
    const b = bloom.current;
    if (!b) return;
    const g = glow.value >= 0 ? glow.value : 0;
    b.luminanceMaterial.threshold = 1.6 - 0.85 * g;
    b.intensity = 0.35 + 0.75 * g;
  });
  return (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO halfRes quality="performance" aoRadius={0.9} distanceFalloff={0.7} intensity={2.4} color="#1d1a2e" />
      <Bloom ref={bloom} mipmapBlur luminanceThreshold={1.6} luminanceSmoothing={0.25} intensity={0.4} radius={0.72} />
      <Vignette offset={0.32} darkness={0.4} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
