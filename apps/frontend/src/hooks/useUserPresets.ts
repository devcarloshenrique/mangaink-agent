import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { presetsApi } from "@/lib/api";
import type { UserPresetResponse } from "@/types/conversion";

export function useUserPresets() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["user-presets"],
    queryFn: () => presetsApi.list(),
    staleTime: 30_000,
  });

  const create = useMutation({
    mutationFn: presetsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-presets"] });
    },
  });

  const updateMeta = useMutation({
    mutationFn: ({
      presetId,
      ...body
    }: {
      presetId: string;
      name?: string;
      description?: string | null;
      isDefault?: boolean;
    }) => presetsApi.updateMeta(presetId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-presets"] });
    },
  });

  const updateValues = useMutation({
    mutationFn: ({
      presetId,
      values,
    }: {
      presetId: string;
      values: Record<string, string | number | boolean>;
    }) => presetsApi.updateValues(presetId, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-presets"] });
    },
  });

  const remove = useMutation({
    mutationFn: presetsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-presets"] });
    },
  });

  return {
    presets: data?.presets ?? [],
    limit: data?.limit ?? 0,
    isLoading,
    error,
    isAtLimit: data ? data.presets.length >= data.limit : false,
    create: (input: {
      name: string;
      description?: string;
      values: Record<string, string | number | boolean>;
      isDefault?: boolean;
    }) => create.mutateAsync(input),
    updateMeta: (
      presetId: string,
      body: { name?: string; description?: string | null; isDefault?: boolean },
    ) => updateMeta.mutateAsync({ presetId, ...body }),
    updateValues: (presetId: string, values: Record<string, string | number | boolean>) =>
      updateValues.mutateAsync({ presetId, values }),
    remove: (presetId: string) => remove.mutateAsync(presetId),
  };
}
