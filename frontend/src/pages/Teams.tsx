import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '../lib/api';
import { useAppStore } from '../lib/store';
import { Team } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/form-field';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';

export const Teams: React.FC = () => {
  const queryClient = useQueryClient();
  const { currentTeam, setCurrentTeam } = useAppStore();
  const [newTeamName, setNewTeamName] = useState('');
  const [error, setError] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
  });

  const createTeamMutation = useMutation({
    mutationFn: (name: string) => teamsApi.create(name),
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setNewTeamName('');
      setError('');
      setCurrentTeam(newTeam);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create team');
    },
  });

  const handleCreateTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      setError('Team name is required');
      return;
    }
    createTeamMutation.mutate(newTeamName);
  };

  const handleSelectTeam = (team: Team) => {
    setCurrentTeam(team);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Teams</h1>
      </div>

      {/* Create Team */}
      <Card>
        <CardHeader>
          <CardTitle>Create a Team</CardTitle>
          <CardDescription>Create a new team to start monitoring your infrastructure</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTeam} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex gap-2">
              <Input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" disabled={createTeamMutation.isPending}>
                {createTeamMutation.isPending ? 'Creating...' : 'Create Team'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Team List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {teams?.map((team: Team) => (
          <Card
            key={team.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              currentTeam?.id === team.id ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSelectTeam(team)}
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">{team.name}</CardTitle>
                  <CardDescription className="mt-1">@{team.slug}</CardDescription>
                </div>
                {currentTeam?.id === team.id && <Badge variant="success">Active</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">
                {team.members?.length || 0} member{team.members?.length !== 1 ? 's' : ''}
              </div>
              <div className="text-xs text-gray-500 mt-2">Created {new Date(team.created_at).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {teams && teams.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-gray-600">No teams yet. Create your first team to get started!</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
