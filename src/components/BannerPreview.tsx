import { useEffect, useState } from 'react'
import { shopAssetUrl } from '../config'
import { type Banner } from '../data/banner'

type BannerPreviewProps = {
  banners: Banner[]
  caption: string
  badge?: string
}

export function BannerPreview({ banners, caption, badge }: BannerPreviewProps) {
  const [index, setIndex] = useState(0)
  const [broken, setBroken] = useState<Record<string, true>>({})
  const total = banners.length
  const slide = banners[Math.min(index, Math.max(total - 1, 0))]
  const imageSrc = slide ? shopAssetUrl(slide.image) : ''

  const identity = banners.map((item) => item.id).join(',')

  useEffect(() => {
    setIndex(0)
  }, [identity])

  return (
    <section className="panel banner-preview-panel">
      <div className="panel-head">
        <div>
          <h2>Shop preview</h2>
          <p className="muted">{caption}</p>
        </div>
        {badge ? <span className="banner-preview-badge">{badge}</span> : null}
      </div>
      {slide ? (
        <div className="banner-preview" aria-label="Banner preview">
          <div className="banner-preview-media">
            {imageSrc && !broken[imageSrc] ? (
              <img
                src={imageSrc}
                alt=""
                onError={() => setBroken((current) => ({ ...current, [imageSrc]: true }))}
              />
            ) : (
              <div className="banner-preview-fallback">No image</div>
            )}
          </div>
          <div className="banner-preview-copy">
            <p className="banner-preview-eyebrow">tescgsm</p>
            <h3>{slide.title || 'Banner title'}</h3>
            <p className="banner-preview-lede">{slide.body || 'Banner text appears here.'}</p>
            <span className="banner-preview-cta">{slide.ctaLabel || 'Shop now'}</span>
          </div>
          {total > 1 ? (
            <div className="banner-preview-dots" role="tablist" aria-label="Banner slides">
              {banners.map((banner, slideIndex) => (
                <button
                  key={`${banner.id}-${slideIndex}`}
                  type="button"
                  role="tab"
                  aria-label={`Show slide ${slideIndex + 1}`}
                  aria-selected={slideIndex === index}
                  className={slideIndex === index ? 'is-active' : ''}
                  onClick={() => setIndex(slideIndex)}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="banner-preview is-empty">
          <p>No active banners to show on the shop.</p>
        </div>
      )}
    </section>
  )
}
