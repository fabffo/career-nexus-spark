import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface SalarieHistoryDialogProps {
  salarieId: string;
  salarieName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalarieHistoryDialog({ salarieId, salarieName, open, onOpenChange }: SalarieHistoryDialogProps) {
  // Pour l'instant, des données mockées - à remplacer par de vraies données
  const mockHistory = {
    documents: [
      { id: '1', type: 'CV', date: new Date('2024-01-15'), action: 'Ajout' },
      { id: '2', type: 'Recommandation', date: new Date('2024-01-16'), action: 'Ajout' },
    ],
    comments: [
      { id: '1', author: 'Jean Dupont', date: new Date('2024-01-17'), content: 'Profil intéressant' },
    ],
    activities: [
      { id: '1', type: 'Création', date: new Date('2024-01-15'), description: 'Profil créé' },
      { id: '2', type: 'Modification', date: new Date('2024-01-16'), description: 'Ajout du CV' },
    ],
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Historique de {salarieName}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="activities" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activities">Activités</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="comments">Commentaires</TabsTrigger>
          </TabsList>

          <TabsContent value="activities" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique des activités</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockHistory.activities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{activity.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(activity.date, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm">{activity.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Historique des documents</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockHistory.documents.map((doc) => (
                  <div key={doc.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <FileText className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{doc.type}</span>
                        <Badge variant="secondary">{doc.action}</Badge>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(doc.date, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Commentaires</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mockHistory.comments.map((comment) => (
                  <div key={comment.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                    <MessageSquare className="h-5 w-5 text-muted-foreground mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{comment.author}</span>
                        <span className="text-sm text-muted-foreground">
                          {format(comment.date, 'dd MMMM yyyy à HH:mm', { locale: fr })}
                        </span>
                      </div>
                      <p className="text-sm bg-muted/50 p-3 rounded-lg">{comment.content}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}