interface State {
  userPermission?: {
    uiPermissions: string[];
  };
  init: () => void;
  shouldDisplay?: boolean;
  fetchUserPermission: () => void;
}

const resolveCurrentUser = (state: State, currentUser?: string): string | undefined => {
  if (currentUser !== undefined && currentUser !== "") {
    return currentUser;
  }

  const $el = (state as Record<string, unknown>).$el as HTMLElement | undefined;
  return $el?.dataset?.currentUser;
};

export default (permission: string, currentUser?: string): State => ({
  userPermission: undefined,

  init() {
    this.fetchUserPermission();
  },

  get shouldDisplay() {
    const user = resolveCurrentUser(this, currentUser);
    if (user === "anonymousUser" || user === undefined || user === "") {
      return false;
    }

    if (!this.userPermission) {
      return false;
    }

    if (this.userPermission.uiPermissions.includes(permission)) {
      return true;
    }

    return false;
  },

  async fetchUserPermission() {
    const response = await fetch(
      `/apis/api.console.halo.run/v1alpha1/users/-/permissions`,
    ).catch(() => undefined);

    if (response?.ok) {
      this.userPermission = await response.json();
    }
  },
});
