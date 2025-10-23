import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Calendar, FileText } from "lucide-react";
import FiscaliteDashboard from "@/components/fiscalite/FiscaliteDashboard";
import CalendrierFiscal from "@/components/fiscalite/CalendrierFiscal";
import TypesImpots from "@/components/fiscalite/TypesImpots";

export default function Fiscalite() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gestion Fiscale SASU</h1>
        <p className="text-muted-foreground mt-2">
          Suivi des impôts, échéances et obligations fiscales
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" />
            Tableau de bord
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <Calendar className="h-4 w-4" />
            Calendrier
          </TabsTrigger>
          <TabsTrigger value="types" className="gap-2">
            <FileText className="h-4 w-4" />
            Types d'impôts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <FiscaliteDashboard />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <CalendrierFiscal />
        </TabsContent>

        <TabsContent value="types" className="space-y-6">
          <TypesImpots />
        </TabsContent>
      </Tabs>
    </div>
  );
}
