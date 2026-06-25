import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Package } from "lucide-react";

interface RelatedProduct {
  id: number;
  nome: string;
  slug: string | null;
  precoPix: string | null;
  imagem: string | null;
  size: string | null;
  medidas: string | null;
}

interface Props {
  familySlug: string;
  currentProductId: number;
  lojaId: number;
}

export function RelatedProducts({ familySlug, currentProductId, lojaId }: Props) {
  const { data: related = [] } = useQuery<RelatedProduct[]>({
    queryKey: ["related-products", familySlug, currentProductId, lojaId],
    queryFn: async () => {
      const res = await fetch(`/api/produtos/related/${encodeURIComponent(familySlug)}?exclude=${currentProductId}&lojaId=${lojaId}`);
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  if (related.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.25 }}
      className="mt-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
    >
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Package className="w-5 h-5 text-blue-500" />
        <h2 className="text-slate-800 font-semibold">Outros tamanhos desta linha</h2>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-min">
          {related.map(p => (
            <a
              key={p.id}
              href={p.slug ? `/produto/${p.slug}` : undefined}
              className="flex-shrink-0 w-40 rounded-xl border border-slate-100 hover:border-red-300 hover:shadow-md transition-all overflow-hidden group"
            >
              <div className="aspect-square bg-slate-50 flex items-center justify-center p-3">
                {p.imagem ? (
                  <img src={p.imagem} alt={p.nome} width={160} height={160} className="w-full h-full object-contain" loading="lazy" />
                ) : (
                  <Package className="w-10 h-10 text-slate-200" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-700 line-clamp-2 group-hover:text-red-600 transition-colors">
                  {p.nome}
                </p>
                {p.size && (
                  <span className="inline-block text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                    {p.size}
                  </span>
                )}
                {p.precoPix && (
                  <p className="text-sm font-bold text-green-600">{p.precoPix}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
