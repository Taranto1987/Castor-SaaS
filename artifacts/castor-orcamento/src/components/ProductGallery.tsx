import { useState, useCallback, useEffect } from "react";
import { Package } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  label: string | null;
}

interface Props {
  imagens: GalleryImage[];
  productName: string;
}

export function ProductGallery({ imagens, productName }: Props) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const count = imagens.length;

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api, onSelect]);

  if (count === 0) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-square flex items-center justify-center p-6">
        <Package className="w-24 h-24 text-slate-200" />
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-square flex items-center justify-center p-6">
        <img src={imagens[0].url} alt={imagens[0].label ?? productName} className="w-full h-full object-contain" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
      <Carousel setApi={setApi} opts={{ loop: true }} className="relative">
        <CarouselContent className="-ml-0">
          {imagens.map((img, i) => (
            <CarouselItem key={i} className="pl-0">
              <div className="aspect-square flex items-center justify-center p-6">
                <img
                  src={img.url}
                  alt={img.label ?? `${productName} - ${i + 1}`}
                  className="w-full h-full object-contain"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2 bg-white/80 backdrop-blur hover:bg-white border-slate-200" />
        <CarouselNext className="right-2 bg-white/80 backdrop-blur hover:bg-white border-slate-200" />
      </Carousel>
      <div className="flex justify-center gap-1.5 pb-3">
        {imagens.map((_, i) => (
          <button
            key={i}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              i === current ? "bg-red-600 w-4" : "bg-slate-300 hover:bg-slate-400"
            )}
            aria-label={`Ir para imagem ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
