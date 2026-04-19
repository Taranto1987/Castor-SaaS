import { Helmet } from "react-helmet-async";

const SITE_URL = "https://lojacastorcabofrio.com.br";
const SITE_NAME = "Castor Colchões";
const DEFAULT_IMAGE = `${SITE_URL}/logo.png`;

interface SEOProps {
  title: string;
  description: string;
  city?: string;
  canonical?: string;
  /** Override the full canonical URL (takes precedence over canonical path) */
  canonicalUrl?: string;
  jsonLd?: object | object[];
  noindex?: boolean;
}

export function SEO({ title, description, city, canonical, canonicalUrl, jsonLd, noindex }: SEOProps) {
  const keywords = city
    ? `colchão Castor ${city}, loja de colchão ${city}, comprar colchão ${city}, colchões ${city}, colchão ortopédico ${city}`
    : "colchão Castor, loja de colchão Cabo Frio, colchões Araruama, região dos lagos, colchão ortopédico RJ";

  const fullCanonical = canonicalUrl ?? (canonical ? `${SITE_URL}${canonical}` : SITE_URL);

  const schemas = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <html lang="pt-BR" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow"} />
      <link rel="canonical" href={fullCanonical} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta property="og:locale" content="pt_BR" />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

export const LOCAL_BUSINESS_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FurnitureStore",
  name: "Castor Colchões",
  image: DEFAULT_IMAGE,
  url: SITE_URL,
  telephone: "+5522992410112",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Av. Júlia Kubitschek, 64",
    addressLocality: "Cabo Frio",
    addressRegion: "RJ",
    postalCode: "28913-100",
    addressCountry: "BR",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: -22.8789,
    longitude: -42.0189,
  },
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "18:00",
    },
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Saturday"],
      opens: "09:00",
      closes: "13:00",
    },
  ],
  sameAs: [SITE_URL],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    reviewCount: "87",
  },
};
