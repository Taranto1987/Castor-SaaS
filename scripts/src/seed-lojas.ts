import { db } from "@workspace/db";
import { lojasTable } from "@workspace/db/schema";

await db.insert(lojasTable).values([
  {
    slug: "cabo-frio",
    nome: "Exclusiva Castor Cabo Frio",
    operacao: "cabo_frio",
    responsavel: "Thalles",
    whatsappNumero: "5522992410112",
    whatsappDisplay: "(22) 99241-0112",
    endereco: "Avenida Júlia Kubitschek 64, Cabo Frio",
    cidade: "Cabo Frio",
    cidadesJson: ["cabo frio", "arraial do cabo", "buzios", "búzios", "sao pedro da aldeia", "são pedro da aldeia"],
    ativa: true,
  },
  {
    slug: "araruama",
    nome: "Exclusiva Castor Araruama",
    operacao: "araruama",
    responsavel: "Marcela",
    whatsappNumero: "5522988447240",
    whatsappDisplay: "(22) 98844-7240",
    cidade: "Araruama",
    cidadesJson: ["araruama", "saquarema", "bacaxa", "bacaxá", "iguaba", "iguaba grande", "sao vicente", "são vicente", "marica", "maricá", "monte alto"],
    ativa: true,
  },
]).onConflictDoNothing();

console.log("Lojas seedadas com sucesso");
process.exit(0);
