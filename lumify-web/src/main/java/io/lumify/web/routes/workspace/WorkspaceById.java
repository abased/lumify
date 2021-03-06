package io.lumify.web.routes.workspace;

import io.lumify.core.config.Configuration;
import io.lumify.core.model.user.UserRepository;
import io.lumify.core.model.workspace.Workspace;
import io.lumify.core.model.workspace.WorkspaceRepository;
import io.lumify.core.user.User;
import io.lumify.core.util.LumifyLogger;
import io.lumify.core.util.LumifyLoggerFactory;
import io.lumify.web.BaseRequestHandler;
import com.altamiracorp.miniweb.HandlerChain;
import com.google.inject.Inject;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public class WorkspaceById extends BaseRequestHandler {
    private static final LumifyLogger LOGGER = LumifyLoggerFactory.getLogger(WorkspaceById.class);
    private final WorkspaceRepository workspaceRepository;

    @Inject
    public WorkspaceById(
            final WorkspaceRepository workspaceRepo,
            final UserRepository userRepository,
            final Configuration configuration) {
        super(userRepository, configuration);
        workspaceRepository = workspaceRepo;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        final String workspaceId = super.getAttributeString(request, "workspaceId");
        final User authUser = getUser(request);
        LOGGER.info("Attempting to retrieve workspace: %s", workspaceId);
        final Workspace workspace = workspaceRepository.findById(workspaceId, authUser);
        if (workspace == null) {
            LOGGER.warn("Could not find workspace: %s", workspaceId);
            respondWithNotFound(response);
        } else {
            LOGGER.debug("Successfully found workspace");
            request.getSession().setAttribute("activeWorkspace", workspaceId);
            final JSONObject resultJSON = workspaceRepository.toJson(workspace, authUser, true);
            respondWithJson(response, resultJSON);
        }

        chain.next(request, response);
    }
}
