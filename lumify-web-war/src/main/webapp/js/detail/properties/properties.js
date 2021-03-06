
define([
    'flight/lib/component',
    'service/ontology',
    'service/vertex',
    'service/relationship',
    'service/audit',
    'util/vertex/formatters',
    '../dropdowns/propertyForm/propForm',
    'hbs!./template',
    'hbs!../audit/audit-list',
    'data',
    'sf'
], function(
    defineComponent,
    OntologyService,
    VertexService,
    RelationshipService,
    AuditService,
    F,
    PropertyForm,
    propertiesTemplate,
    auditsListTemplate,
    appData,
    sf) {
    'use strict';

    var component = defineComponent(Properties),
        AUDIT_DATE_DISPLAY = ['date-relative', 'date'],
        AUDIT_DATE_DISPLAY_RELATIVE = 0,
        AUDIT_DATE_DISPLAY_REAL = 1,
        MAX_AUDIT_ITEMS = 3,
        CURRENT_DATE_DISPLAY = AUDIT_DATE_DISPLAY_RELATIVE,
        alreadyWarnedAboutMissingOntology = {};

    component.filterPropertiesForDisplay = filterPropertiesForDisplay;
    return component;

    function Properties() {
        var self = this;

        this.ontologyService = new OntologyService();
        this.vertexService = new VertexService();
        this.relationshipService = new RelationshipService();
        this.auditService = new AuditService();

        this.defaultAttrs({
            addNewPropertiesSelector: '.add-new-properties',
            entityAuditsSelector: '.entity_audit_events',
            auditShowAllSelector: '.show-all-button-row button',
            auditDateSelector: '.audit-date',
            auditUserSelector: '.audit-user',
            auditEntitySelector: '.resolved',
            propertiesInfoSelector: 'button.info'
        });

        this.after('initialize', function() {

            this.on('click', {
                addNewPropertiesSelector: this.onAddNewPropertiesClicked,
                auditDateSelector: this.onAuditDateClicked,
                auditUserSelector: this.onAuditUserClicked,
                auditShowAllSelector: this.onAuditShowAll,
                auditEntitySelector: this.onEntitySelected,
            });
            this.on('addProperty', this.onAddProperty);
            this.on('deleteProperty', this.onDeleteProperty);
            this.on('editProperty', this.onEditProperty);
            this.on(document, 'verticesUpdated', this.onVerticesUpdated);

            this.$node
                .closest('.type-content')
                .off('.properties')
                .on('toggleAuditDisplay.properties', this.onToggleAuditing.bind(this));

            this.$node.html(propertiesTemplate({
                properties: null
            }));
            this.displayProperties(this.attr.data.properties);
        });

        this.before('teardown', function() {
            if (this.auditRequest && this.auditRequest.abort) {
                this.auditRequest.abort();
            }
        });

        this.onAuditShowAll = function(event) {
            var row = $(event.target).closest('tr');

            row.prevUntil('.property').removeClass('hidden');
            row.remove();
        };

        this.onEntitySelected = function(event) {
            var self = this,
                $target = $(event.target),
                info = $target.data('info');

            if (info) {
                event.preventDefault();

                var vertexId = info.graphVertexId,
                    vertex = appData.vertex(vertexId);
                if (!vertex) {
                    appData.refresh(vertexId).done(function(v) {
                        self.trigger('selectObjects', { vertices: [v] });
                    });
                } else {
                    this.trigger('selectObjects', { vertices: [vertex] });
                }
            }
        };

        this.onAuditDateClicked = function(event) {
            CURRENT_DATE_DISPLAY = (CURRENT_DATE_DISPLAY + 1) % AUDIT_DATE_DISPLAY.length;

            this.$node.find('.audit-date').each(function() {
                $(this).text($(this).data(AUDIT_DATE_DISPLAY[CURRENT_DATE_DISPLAY]));
            });
        };

        this.onAuditUserClicked = function(event) {
            var userId = $(event.target).data('userId');
            if (userId) {
                this.trigger('startChat', { userId: userId });
            }
        };

        this.onToggleAuditing = function(event, data) {
            var self = this,
                auditsEl = this.select('entityAuditsSelector');

            if (data.displayed) {
                auditsEl.html('<div class="nav-header">Audits<span class="badge loading"/></div>').show();
                this.$node.find('.audit-list').remove();

                var itemTemplate = $.Deferred();
                require(['hbs!detail/properties/item'], itemTemplate.resolve);

                $.when(
                        this.ontologyService.ontology(),
                        this.auditRequest = this.auditService.getAudits(this.attr.data.id),
                        itemTemplate
                    ).done(function(ontology, auditResponse, itemTemplate) {
                        var audits = _.sortBy(auditResponse[0].auditHistory, function(a) {
                                return new Date(a.dateTime).getTime() * -1;
                            }),
                            auditGroups = _.groupBy(audits, function(a) {
                                if (a.entityAudit) {
                                    var concept = ontology.conceptsById[a.data.type]
                                    if (concept) {
                                        a.data.displayType = concept.displayName;
                                    }
                                }

                                if (a.propertyAudit) {
                                    a.propertyAudit.isVisibility =
                                        a.propertyAudit.propertyName === 'http://lumify.io#visibilityJson';
                                    a.propertyAudit.visibilityValue =
                                        a.propertyAudit.propertyMetadata['http://lumify.io#visibilityJson'];
                                    a.propertyAudit.formattedValue = F.vertex.displayProp({
                                        name: a.propertyAudit.propertyName,
                                        value: a.propertyAudit.newValue || a.propertyAudit.previousValue
                                    });
                                    a.propertyAudit.isDeleted = a.propertyAudit.newValue === '';

                                    return 'property';
                                }

                                if (a.relationshipAudit) {
                                    a.relationshipAudit.sourceIsCurrent =
                                        a.relationshipAudit.sourceId === self.attr.data.id;
                                    a.relationshipAudit.sourceInfo =
                                        self.createInfoJsonFromAudit(a.relationshipAudit, 'source');
                                    a.relationshipAudit.destInfo =
                                        self.createInfoJsonFromAudit(a.relationshipAudit, 'dest');
                                }

                                return 'other';
                            });

                        self.select('entityAuditsSelector')
                            .empty()
                            .append('<table></table>')
                            .find('table')
                            .append(auditsListTemplate({
                                audits: auditGroups.other || [],
                                MAX_TO_DISPLAY: MAX_AUDIT_ITEMS
                            }));

                        if (auditGroups.property) {
                            self.updatePropertyAudits(itemTemplate, auditGroups.property);
                        }
                        auditsEl.show();

                        self.trigger('updateDraggables');
                        self.updateVisibility();
                    });
            } else {
                auditsEl.hide();
                this.$node.find('.audit-row').remove();
                this.$node.find('.audit-only-property').remove();
                this.$node.find('.show-all-button-row').remove();
            }
        };

        this.updatePropertyAudits = function(itemTemplate, audits) {
            var self = this,
                auditsByProperty = _.groupBy(audits, function(a) {
                    return a.propertyAudit.propertyName + a.propertyAudit.propertyKey;
                });

            Object.keys(auditsByProperty).forEach(function(propertyNameAndKey) {
                var propLi = self.$node.find('.property-' + F.className.to(propertyNameAndKey)),
                    audits = auditsByProperty[propertyNameAndKey],
                    propertyKey = audits[0].propertyAudit.propertyKey,
                    propertyName = audits[0].propertyAudit.propertyName;

                if (!propLi.length) {
                    var property = self.ontologyProperties.byTitle[propertyName],
                        value;

                    if (property && property.userVisible) {
                        for (var i = 0; i < audits.length; i++) {
                            var propAudit = audits[i].propertyAudit;
                            value = propAudit.newValue || propAudit.previousValue;
                            if (value) {
                                break;
                            }
                        }

                        propLi = $(
                            itemTemplate({
                                displayType: property.dataType,
                                name: propertyName,
                                key: propertyKey,
                                displayName: property.displayName,
                                stringValue: F.vertex.displayProp({
                                    name: propertyName,
                                    value: value
                                }),
                                value: value || 'deleted',
                                metadata: {}
                            })
                        ).addClass('audit-only-property').insertBefore(self.$node.find('table tbody .buttons-row'));
                    } else if (_.isUndefined(property)) {
                        console.warn(propertyName + " in audit record doesn't exist in ontology");
                    }
                }

                propLi.after(auditsListTemplate({
                    audits: audits,
                    MAX_TO_DISPLAY: MAX_AUDIT_ITEMS
                }));
            });

            this.updatePopovers();
        };

        this.createInfoJsonFromAudit = function(audit, direction) {
            var info;

            if (direction) {
                var type = audit[direction + 'Type'];

                info = {
                    'http://lumify.io#conceptType': audit[direction + 'Type'],
                    title: audit[direction + 'Title'],
                    graphVertexId: audit[direction + 'Id']
                };
            } else {
                info = {
                    _type: audit.type,
                    'http://lumify.io#conceptType': audit.subType,
                    title: audit.title,
                    graphVertexId: audit.id
                };
            }

            return JSON.stringify(info);
        };

        this.onVerticesUpdated = function(event, data) {
            var self = this;

            data.vertices.forEach(function(vertex) {
                if (vertex.id === self.attr.data.id) {
                    self.attr.data.properties = vertex.properties;
                    self.displayProperties(vertex.properties);
                }
            });
        };

        this.onDeleteProperty = function(event, data) {
            var self = this;

            if (F.vertex.isEdge(this.attr.data)) {
                self.relationshipService.deleteProperty(
                        data.property.name,
                        this.attr.data.properties.source.value,
                        this.attr.data.properties.target.value,
                        this.attr.data.id)
                .fail(this.requestFailure.bind(this))
                .done(function(newProperties) {
                    var properties = $.extend({}, self.attr.data.properties, newProperties);
                    self.displayProperties(properties);
                });

            } else {
                this.vertexService.deleteProperty(this.attr.data.id, data.property)
                    .fail(this.requestFailure.bind(this, event.target))
            }
        };

        this.onAddProperty = function(event, data) {
            var self = this,
                isEdge = F.vertex.isEdge(this.attr.data),
                done = isEdge ? function(edge) {
                    self.attr.data.properties = edge.properties;
                    self.displayProperties(edge.properties);
                } : function() { };

            if (data.property.name === 'http://lumify.io#visibilityJson') {

                this[isEdge ? 'relationshipService' : 'vertexService'].setVisibility(
                        this.attr.data.id,
                        data.property.visibilitySource)
                    .fail(this.requestFailure.bind(this))
                    .done(done);

            } else if (isEdge) {

                this.relationshipService.setProperty(
                        data.property.name,
                        data.property.value,
                        data.property.visibilitySource,
                        data.property.justificationText,
                        data.property.sourceInfo,
                        this.attr.data.properties.source.value,
                        this.attr.data.properties.target.value,
                        this.attr.data.id)
                    .fail(this.requestFailure.bind(this))
                    .done(done);

            } else {

                this.vertexService.setProperty(
                        this.attr.data.id,
                        data.property.key,
                        data.property.name,
                        data.property.value,
                        data.property.visibilitySource,
                        data.property.justificationText,
                        data.property.sourceInfo)
                    .fail(this.requestFailure.bind(this))
                    .done(done);
            }

        };

        this.requestFailure = function(request, message, error) {
            var target = this.$node.find('.underneath');
            if (_.isElement(request)) {
                target = request;
                request = arguments[1];
                message = arguments[2];
                error = arguments[3];
            }

            try {
                error = JSON.parse(error);
            } catch(e) { }

            this.trigger(target, 'propertyerror', { error: error });
        };

        this.onAddNewPropertiesClicked = function(evt) {
            this.trigger('editProperty');
        };

        this.onEditProperty = function(evt, data) {
            var button = this.select('addNewPropertiesSelector'),
                root = $('<div class="underneath">'),
                property = data && data.property,
                propertyRow = property && $(evt.target).closest('tr')

            this.$node.find('button.info').popover('hide');

            if (propertyRow && propertyRow.length) {
                root.appendTo(
                    $('<tr><td colspan=3></td></tr>')
                        .insertAfter(propertyRow)
                        .find('td')
                );
            } else {
                root.insertAfter(button);
            }

            PropertyForm.teardownAll();
            PropertyForm.attachTo(root, {
                data: this.attr.data,
                property: property
            });
        };

        this.updatePopovers = function() {
            var self = this;

            require(['detail/properties/propertyInfo'], function(PropertyInfo) {

                var infos = self.$node.find('.info');

                infos.each(function() {
                    var $this = $(this),
                    property = $this.data('property'),
                    ontologyProperty = self.ontologyProperties.byTitle[property.name];

                    if (property.name === 'http://lumify.io#visibilityJson' || ontologyProperty) {
                        $this.popover('destroy');
                        $this.popover({
                            trigger: 'click',
                            placement: 'top',
                            content: 'Loading...',
                            //delay: { show: 100, hide: 1000 }
                        });

                        $this.on('shown', function() {
                            infos.not($this).popover('hide');
                            $(document).off('.propertyInfo').on('click.propertyInfo', function(event) {
                                var $target = $(event.target);

                                if (!$target.is($this) &&
                                    $target.closest('.popover').length === 0) {

                                    $this.popover('hide');
                                    $(document).off('.propertyInfo');
                                }
                            });

                            self.trigger(content, 'willDisplayPropertyInfo');
                        });

                        var popover = $this.data('popover'),
                        tip = popover.tip(),
                        content = tip.find('.popover-content');

                        popover.setContent = function() {
                            var $tip = this.tip()
                            $tip.removeClass('fade in top bottom left right')
                        };

                        content.teardownAllComponents();
                        PropertyInfo.attachTo(content, {
                            property: $this.data('property')
                        })
                    } else {
                        $this.remove();
                    }
                })
            })
        }

        this.displayProperties = function(properties) {
            var self = this;

            this.ontologyService.properties()
                .done(function(ontologyProperties) {
                    var filtered = filterPropertiesForDisplay(properties, ontologyProperties),
                        popoutEnabled = false,
                        iconProperty = _.findWhere(filtered, { key: 'http://lumify.io#glyphIcon' });

                    self.ontologyProperties = ontologyProperties;

                    if (iconProperty) {
                        self.trigger(self.select('glyphIconSelector'), 'iconUpdated', { src: iconProperty.value });
                    }

                    if ($('#app').hasClass('fullscreen-details')) {
                        popoutEnabled = true;
                    }

                    var props = $(propertiesTemplate({
                        properties: _.map(filtered, function(p) {
                            p.popout = popoutEnabled;
                            return p;
                        })
                    }));
                    self.$node.html(props);
                    self.updateVisibility();
                    self.updatePopovers();
                });
            self.trigger('toggleAuditDisplay', { displayed: false })
        };

        this.updateVisibility = function() {
            var self = this;

            require([
                'configuration/plugins/visibility/visibilityDisplay'
            ], function(VisibilityDisplay) {
                self.$node.find('.visibility').each(function() {
                    var visibility = $(this).data('visibility');
                    VisibilityDisplay.attachTo(this, {
                        value: visibility && visibility.source
                    })
                });
            });
        };
    }

    function filterPropertiesForDisplay(properties, ontologyProperties) {
        var visibilityJsonName = 'http://lumify.io#visibilityJson',
            visibilityValue = F.vertex.prop({properties: properties}, visibilityJsonName, {source: ''}),
            visibilityOntology = ontologyProperties.byTitle['http://lumify.io#visibility'],
            displayProperties = [],
            visibilityProperty = {
                isVisibility: true,
                name: visibilityJsonName,
                value: visibilityValue,
                cls: F.className.to(visibilityJsonName),
                displayName: (visibilityOntology && visibilityOntology.displayName) ||
                    'Visibility',
                visibilityJson: JSON.stringify(visibilityValue),
                metadata: _.pick(
                    _.findWhere(properties, {name: visibilityJsonName}) || {},
                    'http://lumify.io#modifiedBy',
                    'http://lumify.io#modifiedDate'
                )
            };

        displayProperties.push(visibilityProperty);
        visibilityProperty.json = JSON.stringify(visibilityProperty);

        _.sortBy(properties, function(p) {
            var ontologyProperty = ontologyProperties.byTitle[p.name];
            if (ontologyProperty) {
                return ontologyProperty.displayName;
            }
            return p.name;
        }).forEach(function(property) {
            var value = property.value,
                name = property.name,
                stringValue = F.vertex.displayProp(property),
                ontologyProperty = ontologyProperties.byTitle[name],
                displayName = ontologyProperty && ontologyProperty.displayName,
                displayType = ontologyProperty && ontologyProperty.dataType,
                visibility = property['http://lumify.io#visibilityJson'],
                isEdge = F.vertex.isEdge({properties: properties}),
                isRelationshipType = name === 'relationshipType' && isEdge,
                propertyView;

            if (ontologyProperty && ontologyProperty.userVisible) {
                propertyView = {
                    name: name,
                    key: property.key,
                    value: value,
                    cls: F.className.to(name + property.key),
                    stringValue: _.isUndefined(stringValue) ? value : stringValue,
                    displayName: displayName || name,
                    displayType: displayType || 'string',
                    visibility: visibility,
                    visibilityJson: _.isUndefined(visibility) ? '' : JSON.stringify(visibility),
                    metadata: _.pick(
                        property,
                        '_justificationMetadata',
                        '_sourceMetadata',
                        'http://lumify.io#modifiedBy',
                        'http://lumify.io#modifiedDate',
                        'sandboxStatus'
                    )
                }
                propertyView[displayType] = true;
                propertyView.json = JSON.stringify(propertyView);
                displayProperties.push(propertyView);
            }
        });

        return displayProperties;
    }
});
