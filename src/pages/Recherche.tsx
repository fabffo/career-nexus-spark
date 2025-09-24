import { useState } from "react";
import { Search, Users, Briefcase, Building2, Calendar, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CandidatHistoryDialog } from "@/components/CandidatHistoryDialog";
import { PosteHistoryDialog } from "@/components/PosteHistoryDialog";
import { ViewClientDialog } from "@/components/ViewClientDialog";
import { candidatService, clientService, rdvService, posteService } from "@/services";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Candidat, Client, PosteClient, Rdv } from "@/types/models";

interface SearchResult {
  candidats: Candidat[];
  clients: Client[];
  postes: PosteClient[];
  rdvs: Rdv[];
}

export default function Recherche() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult>({
    candidats: [],
    clients: [],
    postes: [],
    rdvs: []
  });
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState("tous");
  const { toast } = useToast();

  // Dialog states
  const [selectedCandidat, setSelectedCandidat] = useState<Candidat | null>(null);
  const [selectedPoste, setSelectedPoste] = useState<PosteClient | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isCandidatHistoryOpen, setIsCandidatHistoryOpen] = useState(false);
  const [isPosteHistoryOpen, setIsPosteHistoryOpen] = useState(false);
  const [isClientViewOpen, setIsClientViewOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast({
        title: "Recherche vide",
        description: "Veuillez saisir un terme de recherche",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const [candidats, clients, postes, rdvs] = await Promise.all([
        candidatService.getAll(),
        clientService.getAll(),
        posteService.getAll(),
        rdvService.getAll()
      ]);

      const query = searchQuery.toLowerCase();

      // Recherche dans les candidats
      const filteredCandidats = candidats.filter(c => 
        c.nom?.toLowerCase().includes(query) ||
        c.prenom?.toLowerCase().includes(query) ||
        c.mail?.toLowerCase().includes(query) ||
        c.telephone?.toLowerCase().includes(query)
      );

      // Recherche dans les clients
      const filteredClients = clients.filter(c =>
        c.raisonSociale?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.telephone?.toLowerCase().includes(query) ||
        c.adresse?.toLowerCase().includes(query)
      );

      // Recherche dans les postes
      const filteredPostes = postes.filter(p =>
        p.nomPoste?.toLowerCase().includes(query) ||
        p.detail?.toLowerCase().includes(query)
      );

      // Recherche dans les rendez-vous
      const filteredRdvs = rdvs.filter(r =>
        r.typeRdv?.toLowerCase().includes(query) ||
        r.lieu?.toLowerCase().includes(query) ||
        r.notes?.toLowerCase().includes(query)
      );

      setSearchResults({
        candidats: filteredCandidats,
        clients: filteredClients,
        postes: filteredPostes,
        rdvs: filteredRdvs
      });

      // Auto-sélection de l'onglet avec des résultats
      if (filteredCandidats.length > 0) setActiveTab("candidats");
      else if (filteredClients.length > 0) setActiveTab("clients");
      else if (filteredPostes.length > 0) setActiveTab("postes");
      else if (filteredRdvs.length > 0) setActiveTab("rdvs");
      else setActiveTab("tous");

    } catch (error) {
      console.error("Erreur lors de la recherche:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la recherche",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const getTotalResults = () => {
    return searchResults.candidats.length + 
           searchResults.clients.length + 
           searchResults.postes.length + 
           searchResults.rdvs.length;
  };

  const handleCandidatHistory = (candidat: Candidat) => {
    setSelectedCandidat(candidat);
    setIsCandidatHistoryOpen(true);
  };

  const handlePosteHistory = (poste: PosteClient) => {
    setSelectedPoste(poste);
    setIsPosteHistoryOpen(true);
  };

  const handleClientView = (client: Client) => {
    setSelectedClient(client);
    setIsClientViewOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Recherche intelligente</h1>
        <p className="text-muted-foreground mt-2">
          Recherchez dans l'historique des candidats, clients et postes
        </p>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardHeader>
          <CardTitle>Rechercher</CardTitle>
          <CardDescription>
            Entrez un nom, email, téléphone ou tout autre terme pour rechercher
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? "Recherche..." : "Rechercher"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Résultats */}
      {getTotalResults() > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Résultats ({getTotalResults()})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="tous">
                  Tous ({getTotalResults()})
                </TabsTrigger>
                <TabsTrigger value="candidats">
                  <Users className="mr-2 h-4 w-4" />
                  Candidats ({searchResults.candidats.length})
                </TabsTrigger>
                <TabsTrigger value="clients">
                  <Building2 className="mr-2 h-4 w-4" />
                  Clients ({searchResults.clients.length})
                </TabsTrigger>
                <TabsTrigger value="postes">
                  <Briefcase className="mr-2 h-4 w-4" />
                  Postes ({searchResults.postes.length})
                </TabsTrigger>
                <TabsTrigger value="rdvs">
                  <Calendar className="mr-2 h-4 w-4" />
                  RDV ({searchResults.rdvs.length})
                </TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[500px] mt-4">
                <TabsContent value="tous" className="space-y-4">
                  {searchResults.candidats.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Candidats
                      </h3>
                      <div className="space-y-2">
                        {searchResults.candidats.map((candidat) => (
                          <Card key={candidat.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="flex justify-between items-center p-4">
                              <div>
                                <p className="font-medium">{candidat.prenom} {candidat.nom}</p>
                                <p className="text-sm text-muted-foreground">{candidat.mail}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCandidatHistory(candidat)}
                              >
                                <History className="h-4 w-4 mr-2" />
                                Historique
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.clients.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Clients
                      </h3>
                      <div className="space-y-2">
                        {searchResults.clients.map((client) => (
                          <Card key={client.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="flex justify-between items-center p-4">
                              <div>
                                <p className="font-medium">{client.raisonSociale}</p>
                                <p className="text-sm text-muted-foreground">{client.email}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleClientView(client)}
                              >
                                <History className="h-4 w-4 mr-2" />
                                Voir détails
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.postes.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Postes
                      </h3>
                      <div className="space-y-2">
                        {searchResults.postes.map((poste) => (
                          <Card key={poste.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="flex justify-between items-center p-4">
                              <div>
                                <p className="font-medium">{poste.nomPoste}</p>
                                <div className="flex gap-2 mt-1">
                                  <Badge variant="outline">{poste.statut}</Badge>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePosteHistory(poste)}
                              >
                                <History className="h-4 w-4 mr-2" />
                                Historique
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {searchResults.rdvs.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Rendez-vous
                      </h3>
                      <div className="space-y-2">
                        {searchResults.rdvs.map((rdv) => (
                          <Card key={rdv.id} className="cursor-pointer hover:bg-muted/50">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{rdv.typeRdv}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(rdv.date), "PPP à HH:mm", { locale: fr })}
                                  </p>
                                  {rdv.lieu && (
                                    <p className="text-sm text-muted-foreground">{rdv.lieu}</p>
                                  )}
                                </div>
                                <Badge variant={rdv.statut === "REALISE" ? "default" : "secondary"}>
                                  {rdv.statut}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="candidats" className="space-y-2">
                  {searchResults.candidats.map((candidat) => (
                    <Card key={candidat.id} className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="flex justify-between items-center p-4">
                        <div>
                          <p className="font-medium">{candidat.prenom} {candidat.nom}</p>
                          <p className="text-sm text-muted-foreground">{candidat.mail}</p>
                          {candidat.telephone && (
                            <p className="text-sm text-muted-foreground">{candidat.telephone}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCandidatHistory(candidat)}
                        >
                          <History className="h-4 w-4 mr-2" />
                          Historique
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="clients" className="space-y-2">
                  {searchResults.clients.map((client) => (
                    <Card key={client.id} className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="flex justify-between items-center p-4">
                        <div>
                          <p className="font-medium">{client.raisonSociale}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                          {client.telephone && (
                            <p className="text-sm text-muted-foreground">{client.telephone}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleClientView(client)}
                        >
                          <History className="h-4 w-4 mr-2" />
                          Voir détails
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="postes" className="space-y-2">
                  {searchResults.postes.map((poste) => (
                    <Card key={poste.id} className="cursor-pointer hover:bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{poste.nomPoste}</p>
                            {poste.detail && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {poste.detail}
                              </p>
                            )}
                            <div className="flex gap-2 mt-2">
                              <Badge variant="outline">{poste.statut}</Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePosteHistory(poste)}
                          >
                            <History className="h-4 w-4 mr-2" />
                            Historique
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="rdvs" className="space-y-2">
                  {searchResults.rdvs.map((rdv) => (
                    <Card key={rdv.id}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{rdv.typeRdv}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(rdv.date), "PPP à HH:mm", { locale: fr })}
                            </p>
                            {rdv.lieu && (
                              <p className="text-sm text-muted-foreground">{rdv.lieu}</p>
                            )}
                            {rdv.notes && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                {rdv.notes}
                              </p>
                            )}
                          </div>
                          <Badge variant={rdv.statut === "REALISE" ? "default" : "secondary"}>
                            {rdv.statut}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      {selectedCandidat && (
        <CandidatHistoryDialog
          candidat={selectedCandidat}
          open={isCandidatHistoryOpen}
          onOpenChange={(open) => {
            setIsCandidatHistoryOpen(open);
            if (!open) setSelectedCandidat(null);
          }}
        />
      )}

      {selectedPoste && (
        <PosteHistoryDialog
          posteId={selectedPoste.id}
          isOpen={isPosteHistoryOpen}
          onClose={() => {
            setIsPosteHistoryOpen(false);
            setSelectedPoste(null);
          }}
        />
      )}

      {selectedClient && (
        <ViewClientDialog
          client={selectedClient}
          open={isClientViewOpen}
          onOpenChange={(open) => {
            setIsClientViewOpen(open);
            if (!open) setSelectedClient(null);
          }}
        />
      )}
    </div>
  );
}