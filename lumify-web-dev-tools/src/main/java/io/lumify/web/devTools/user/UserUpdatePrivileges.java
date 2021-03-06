package io.lumify.web.devTools.user;

import com.altamiracorp.miniweb.HandlerChain;
import com.google.inject.Inject;
import io.lumify.core.config.Configuration;
import io.lumify.core.model.user.UserRepository;
import io.lumify.core.user.Privilege;
import io.lumify.core.user.User;
import io.lumify.core.util.LumifyLogger;
import io.lumify.core.util.LumifyLoggerFactory;
import io.lumify.web.BaseRequestHandler;
import org.json.JSONObject;
import org.securegraph.Graph;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.util.Set;

public class UserUpdatePrivileges extends BaseRequestHandler {
    private static final LumifyLogger LOGGER = LumifyLoggerFactory.getLogger(UserUpdatePrivileges.class);
    private final Graph graph;

    @Inject
    public UserUpdatePrivileges(
            final UserRepository userRepository,
            final Configuration configuration,
            final Graph graph) {
        super(userRepository, configuration);
        this.graph = graph;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, HandlerChain chain) throws Exception {
        String userName = getRequiredParameter(request, "user-name");
        Set<Privilege> privileges = Privilege.stringToPrivileges(getRequiredParameter(request, "privileges"));

        User user = getUserRepository().findByUsername(userName);
        if (user == null) {
            respondWithNotFound(response);
            return;
        }

        LOGGER.info("Setting user %s privileges to %s", user.getUserId(), Privilege.toString(privileges));
        getUserRepository().setPrivileges(user, privileges);
        this.graph.flush();

        JSONObject json = new JSONObject();
        respondWithJson(response, json);
    }
}
